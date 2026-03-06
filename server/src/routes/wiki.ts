import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

// List articles (with optional filters)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { category, life_stage, relationship_type, search, limit = '20', offset = '0' } = req.query;

    let query = `
      SELECT wa.*, u.username AS author_username, u.display_name AS author_display_name, u.user_type AS author_user_type
      FROM wiki_articles wa
      JOIN users u ON u.id = wa.author_id
      WHERE wa.status = 'published'
    `;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (category) {
      query += ` AND wa.category = $${paramIdx++}`;
      params.push(category);
    }
    if (life_stage) {
      query += ` AND wa.life_stage = $${paramIdx++}`;
      params.push(life_stage);
    }
    if (relationship_type) {
      query += ` AND wa.relationship_type = $${paramIdx++}`;
      params.push(relationship_type);
    }
    if (search) {
      query += ` AND (wa.title ILIKE $${paramIdx} OR wa.content ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    query += ` ORDER BY wa.upvotes DESC, wa.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(Number(limit), Number(offset));

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get single article
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const article = await db.query(
      `SELECT wa.*, u.username AS author_username, u.display_name AS author_display_name, u.user_type AS author_user_type
       FROM wiki_articles wa
       JOIN users u ON u.id = wa.author_id
       WHERE wa.id = $1`,
      [req.params.id]
    );

    if (article.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Get comments
    const comments = await db.query(
      `SELECT wc.*, u.username AS author_username, u.display_name AS author_display_name
       FROM wiki_comments wc
       JOIN users u ON u.id = wc.author_id
       WHERE wc.article_id = $1
       ORDER BY wc.created_at ASC`,
      [req.params.id]
    );

    // Get user's vote
    const vote = await db.query(
      `SELECT vote FROM wiki_votes WHERE user_id = $1 AND article_id = $2`,
      [req.userId, req.params.id]
    );

    res.json({
      data: {
        ...article.rows[0],
        comments: comments.rows,
        user_vote: vote.rows[0]?.vote || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Create article
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, category, tags, life_stage, relationship_type } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const result = await db.query(
      `INSERT INTO wiki_articles (author_id, title, content, category, tags, life_stage, relationship_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId, title.trim(), content.trim(), category || null, JSON.stringify(tags || []), life_stage || null, relationship_type || null]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// Update article (author only)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const article = await db.query(`SELECT * FROM wiki_articles WHERE id = $1`, [req.params.id]);
    if (article.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (article.rows[0].author_id !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { title, content, category, tags, life_stage, relationship_type } = req.body;

    const result = await db.query(
      `UPDATE wiki_articles SET
        title = COALESCE($2, title),
        content = COALESCE($3, content),
        category = COALESCE($4, category),
        tags = COALESCE($5, tags),
        life_stage = COALESCE($6, life_stage),
        relationship_type = COALESCE($7, relationship_type),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, title, content, category, tags ? JSON.stringify(tags) : null, life_stage, relationship_type]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// Delete article (author only)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const article = await db.query(`SELECT * FROM wiki_articles WHERE id = $1`, [req.params.id]);
    if (article.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (article.rows[0].author_id !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    await db.query(`UPDATE wiki_articles SET status = 'deleted' WHERE id = $1`, [req.params.id]);
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// Vote on article
router.post('/:id/vote', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { vote } = req.body; // 1 or -1

    if (vote !== 1 && vote !== -1) {
      return res.status(400).json({ error: 'Vote must be 1 or -1' });
    }

    // Upsert vote
    const existing = await db.query(
      `SELECT vote FROM wiki_votes WHERE user_id = $1 AND article_id = $2`,
      [req.userId, req.params.id]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].vote === vote) {
        // Remove vote (toggle off)
        await db.query(`DELETE FROM wiki_votes WHERE user_id = $1 AND article_id = $2`, [req.userId, req.params.id]);
        await db.query(`UPDATE wiki_articles SET upvotes = upvotes - $2 WHERE id = $1`, [req.params.id, vote]);
      } else {
        // Change vote
        await db.query(`UPDATE wiki_votes SET vote = $3 WHERE user_id = $1 AND article_id = $2`, [req.userId, req.params.id, vote]);
        await db.query(`UPDATE wiki_articles SET upvotes = upvotes + $2 WHERE id = $1`, [req.params.id, vote * 2]);
      }
    } else {
      await db.query(
        `INSERT INTO wiki_votes (user_id, article_id, vote) VALUES ($1, $2, $3)`,
        [req.userId, req.params.id, vote]
      );
      await db.query(`UPDATE wiki_articles SET upvotes = upvotes + $2 WHERE id = $1`, [req.params.id, vote]);
    }

    const updated = await db.query(`SELECT upvotes FROM wiki_articles WHERE id = $1`, [req.params.id]);
    res.json({ data: { upvotes: updated.rows[0]?.upvotes || 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Add comment
router.post('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const result = await db.query(
      `INSERT INTO wiki_comments (article_id, author_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.userId, content.trim()]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Quizzes
router.get('/quizzes/list', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, title, description, category, relationship_type, created_at FROM quizzes ORDER BY created_at`
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

router.get('/quizzes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await db.query(`SELECT * FROM quizzes WHERE id = $1`, [req.params.id]);
    if (quiz.rows.length === 0) return res.status(404).json({ error: 'Quiz not found' });

    // Get user's previous result if any
    const prevResult = await db.query(
      `SELECT * FROM quiz_results WHERE quiz_id = $1 AND user_id = $2 ORDER BY completed_at DESC LIMIT 1`,
      [req.params.id, req.userId]
    );

    res.json({ data: { ...quiz.rows[0], previous_result: prevResult.rows[0] || null } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

router.post('/quizzes/:id/submit', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { answers } = req.body; // array of selected option indices
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers array required' });
    }

    const quiz = await db.query(`SELECT * FROM quizzes WHERE id = $1`, [req.params.id]);
    if (quiz.rows.length === 0) return res.status(404).json({ error: 'Quiz not found' });

    const questions = quiz.rows[0].questions;

    // Tally categories
    const tally: Record<string, number> = {};
    answers.forEach((answerIdx: number, qIdx: number) => {
      if (qIdx < questions.length && questions[qIdx].categories) {
        const category = questions[qIdx].categories[answerIdx];
        if (category) {
          tally[category] = (tally[category] || 0) + 1;
        }
      }
    });

    // Determine dominant result
    const resultType = Object.entries(tally).sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';
    const maxScore = Math.max(...Object.values(tally), 0);
    const totalQuestions = questions.length;
    const score = totalQuestions > 0 ? Math.round((maxScore / totalQuestions) * 100) : 0;

    const result = await db.query(
      `INSERT INTO quiz_results (quiz_id, user_id, score, result_type, answers) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.userId, score, resultType, JSON.stringify(answers)]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

export default router;
