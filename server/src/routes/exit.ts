import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

// Create exit plan
router.post('/plans', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { relationship_id, reason } = req.body;

    if (!relationship_id) return res.status(400).json({ error: 'relationship_id required' });

    // Verify relationship belongs to user
    const rel = await db.query(
      `SELECT * FROM relationships WHERE id = $1 AND user_id = $2`,
      [relationship_id, req.userId]
    );
    if (rel.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });

    const relType = rel.rows[0].type;

    // Generate default steps based on relationship type
    const steps = generateExitSteps(relType);
    const resources = generateExitResources(relType);

    const result = await db.query(
      `INSERT INTO exit_plans (user_id, relationship_id, reason, steps, resources)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, relationship_id, reason || null, JSON.stringify(steps), JSON.stringify(resources)]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create exit plan' });
  }
});

// Get user's exit plans
router.get('/plans', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT ep.*, r.type AS relationship_type, u.username AS partner_username, u.display_name AS partner_display_name
       FROM exit_plans ep
       JOIN relationships r ON r.id = ep.relationship_id
       JOIN users u ON u.id = r.partner_id
       WHERE ep.user_id = $1
       ORDER BY ep.created_at DESC`,
      [req.userId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exit plans' });
  }
});

// Get specific exit plan
router.get('/plans/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT ep.*, r.type AS relationship_type, u.username AS partner_username, u.display_name AS partner_display_name
       FROM exit_plans ep
       JOIN relationships r ON r.id = ep.relationship_id
       JOIN users u ON u.id = r.partner_id
       WHERE ep.id = $1 AND ep.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Exit plan not found' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exit plan' });
  }
});

// Update exit plan (progress, steps, status)
router.put('/plans/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { steps, status, coaching_session_id } = req.body;

    const plan = await db.query(
      `SELECT * FROM exit_plans WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Exit plan not found' });

    const result = await db.query(
      `UPDATE exit_plans SET
        steps = COALESCE($2, steps),
        status = COALESCE($3, status),
        coaching_session_id = COALESCE($4, coaching_session_id),
        completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $1 RETURNING *`,
      [req.params.id, steps ? JSON.stringify(steps) : null, status, coaching_session_id]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update exit plan' });
  }
});

// Get resources for relationship type
router.get('/resources/:relationshipType', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const relType = req.params.relationshipType as string;
    const resources = generateExitResources(relType);
    res.json({ data: resources });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

function generateExitSteps(relType: string) {
  const common = [
    { step: 'Reflect on your decision', description: 'Take time to understand why this relationship needs to end. Journal your feelings.', completed: false },
    { step: 'Seek support', description: 'Talk to a trusted friend, family member, or professional about your decision.', completed: false },
    { step: 'Plan the conversation', description: 'Prepare what you want to say. Focus on your needs rather than blame.', completed: false },
  ];

  const typeSpecific: Record<string, { step: string; description: string; completed: boolean }[]> = {
    romantic: [
      { step: 'Assess shared responsibilities', description: 'Consider shared finances, living arrangements, and belongings.', completed: false },
      { step: 'Have the conversation', description: 'Choose a private, calm setting. Be honest and compassionate.', completed: false },
      { step: 'Establish boundaries', description: 'Define post-breakup boundaries for communication and contact.', completed: false },
      { step: 'Allow yourself to grieve', description: 'Ending a romantic relationship involves loss. Give yourself time to heal.', completed: false },
    ],
    friend: [
      { step: 'Consider distance vs. ending', description: 'Would reducing contact work, or does the friendship need to fully end?', completed: false },
      { step: 'Address it directly or fade', description: 'Decide whether a direct conversation or gradual distance is healthier.', completed: false },
      { step: 'Preserve mutual connections', description: 'Handle shared friend groups with grace and maturity.', completed: false },
    ],
    professional: [
      { step: 'Document any issues', description: 'Keep records if the relationship involves workplace concerns.', completed: false },
      { step: 'Consult HR if needed', description: 'For workplace relationships, involve appropriate channels.', completed: false },
      { step: 'Transition professionally', description: 'Maintain professionalism and complete any obligations.', completed: false },
    ],
    family: [
      { step: 'Consider limited contact', description: 'For family, full exit may not be possible. Consider low-contact boundaries.', completed: false },
      { step: 'Communicate boundaries clearly', description: 'Express your needs and limits in writing if verbal communication is difficult.', completed: false },
      { step: 'Protect your wellbeing', description: 'Prioritize your mental health while being mindful of family dynamics.', completed: false },
    ],
  };

  return [...common, ...(typeSpecific[relType] || typeSpecific.friend!)];
}

function generateExitResources(relType: string) {
  const common = [
    { title: 'Self-care during difficult transitions', type: 'article', url: null },
    { title: 'When is it time to end a relationship?', type: 'article', url: null },
    { title: 'Finding a therapist or counselor', type: 'resource', url: null },
  ];

  const typeSpecific: Record<string, { title: string; type: string; url: string | null }[]> = {
    romantic: [
      { title: 'Navigating a breakup with compassion', type: 'article', url: null },
      { title: 'Dividing shared assets fairly', type: 'guide', url: null },
      { title: 'National Domestic Violence Hotline: 1-800-799-7233', type: 'hotline', url: null },
    ],
    family: [
      { title: 'Setting boundaries with toxic family members', type: 'article', url: null },
      { title: 'Low-contact vs no-contact strategies', type: 'guide', url: null },
    ],
    professional: [
      { title: 'Leaving a toxic workplace', type: 'article', url: null },
      { title: 'Professional transition checklist', type: 'guide', url: null },
    ],
  };

  return [...common, ...(typeSpecific[relType] || [])];
}

export default router;
