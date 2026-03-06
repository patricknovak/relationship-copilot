import { Router, Response } from 'express';
import { requireAgentAuth, AgentAuthRequest } from '../middleware/agentAuth';
import { db } from '../db';

const router = Router();

// List collaborations for this agent
router.get('/collaborations', requireAgentAuth, async (req: AgentAuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT ac.*,
              u1.username AS initiator_username, u1.display_name AS initiator_name,
              u2.username AS partner_username, u2.display_name AS partner_name
       FROM agent_collaborations ac
       JOIN users u1 ON u1.id = ac.initiator_id
       JOIN users u2 ON u2.id = ac.partner_id
       WHERE (ac.initiator_id = $1 OR ac.partner_id = $1) AND ac.status = 'active'`,
      [req.agentId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch collaborations' });
  }
});

// Initiate collaboration with another agent
router.post('/collaborations', requireAgentAuth, async (req: AgentAuthRequest, res: Response) => {
  try {
    const { partner_id, purpose } = req.body;

    if (!partner_id) return res.status(400).json({ error: 'partner_id required' });

    // Verify partner is an agent
    const partner = await db.query(
      `SELECT user_id FROM agent_profiles WHERE user_id = $1 AND status = 'active'`,
      [partner_id]
    );
    if (partner.rows.length === 0) return res.status(400).json({ error: 'Partner agent not found or inactive' });

    const result = await db.query(
      `INSERT INTO agent_collaborations (initiator_id, partner_id, purpose)
       VALUES ($1, $2, $3)
       ON CONFLICT (initiator_id, partner_id) DO UPDATE SET status = 'active', purpose = $3
       RETURNING *`,
      [req.agentId, partner_id, purpose || null]
    );

    // Notify partner agent
    await db.query(
      `INSERT INTO agent_events (agent_id, event_type, payload)
       VALUES ($1, 'collaboration.initiated', $2)`,
      [partner_id, JSON.stringify({
        collaboration_id: result.rows[0].id,
        initiator_id: req.agentId,
        purpose,
      })]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate collaboration' });
  }
});

// Create task within a collaboration
router.post('/collaborations/:id/tasks', requireAgentAuth, async (req: AgentAuthRequest, res: Response) => {
  try {
    const { assigned_to, task_type, description, input_data } = req.body;

    // Verify this agent is part of the collaboration
    const collab = await db.query(
      `SELECT * FROM agent_collaborations WHERE id = $1 AND (initiator_id = $2 OR partner_id = $2)`,
      [req.params.id, req.agentId]
    );
    if (collab.rows.length === 0) return res.status(404).json({ error: 'Collaboration not found' });

    if (!assigned_to || !task_type) {
      return res.status(400).json({ error: 'assigned_to and task_type required' });
    }

    const result = await db.query(
      `INSERT INTO collaboration_tasks (collaboration_id, assigned_to, task_type, description, input_data)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, assigned_to, task_type, description || null, JSON.stringify(input_data || {})]
    );

    // Notify assigned agent
    await db.query(
      `INSERT INTO agent_events (agent_id, event_type, payload)
       VALUES ($1, 'collaboration.task_assigned', $2)`,
      [assigned_to, JSON.stringify({
        task_id: result.rows[0].id,
        collaboration_id: req.params.id,
        task_type,
        from_agent: req.agentId,
      })]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get tasks for a collaboration
router.get('/collaborations/:id/tasks', requireAgentAuth, async (req: AgentAuthRequest, res: Response) => {
  try {
    const collab = await db.query(
      `SELECT * FROM agent_collaborations WHERE id = $1 AND (initiator_id = $2 OR partner_id = $2)`,
      [req.params.id, req.agentId]
    );
    if (collab.rows.length === 0) return res.status(404).json({ error: 'Collaboration not found' });

    const result = await db.query(
      `SELECT ct.*, u.username AS assigned_username, u.display_name AS assigned_name
       FROM collaboration_tasks ct
       JOIN users u ON u.id = ct.assigned_to
       WHERE ct.collaboration_id = $1
       ORDER BY ct.created_at DESC`,
      [req.params.id]
    );

    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Complete a task
router.put('/tasks/:id/complete', requireAgentAuth, async (req: AgentAuthRequest, res: Response) => {
  try {
    const { output_data } = req.body;

    const result = await db.query(
      `UPDATE collaboration_tasks
       SET status = 'completed', output_data = $2, completed_at = NOW()
       WHERE id = $1 AND assigned_to = $3 AND status = 'pending'
       RETURNING *`,
      [req.params.id, JSON.stringify(output_data || {}), req.agentId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found or not assigned to you' });

    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Skills management
router.get('/skills', requireAgentAuth, async (req: AgentAuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM agent_skills WHERE agent_id = $1 ORDER BY level DESC, xp DESC`,
      [req.agentId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

// Register or update a skill
router.post('/skills', requireAgentAuth, async (req: AgentAuthRequest, res: Response) => {
  try {
    const { skill_name, category } = req.body;

    if (!skill_name) return res.status(400).json({ error: 'skill_name required' });

    const result = await db.query(
      `INSERT INTO agent_skills (agent_id, skill_name, category)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id, skill_name) DO NOTHING
       RETURNING *`,
      [req.agentId, skill_name, category || null]
    );

    if (result.rows.length === 0) {
      const existing = await db.query(
        `SELECT * FROM agent_skills WHERE agent_id = $1 AND skill_name = $2`,
        [req.agentId, skill_name]
      );
      res.json({ data: existing.rows[0] });
    } else {
      res.status(201).json({ data: result.rows[0] });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to register skill' });
  }
});

// Log skill progress (gain XP)
router.post('/skills/:skillId/progress', requireAgentAuth, async (req: AgentAuthRequest, res: Response) => {
  try {
    const { xp_gained, reason } = req.body;

    if (!xp_gained || xp_gained < 0) return res.status(400).json({ error: 'Positive xp_gained required' });

    // Verify skill belongs to this agent
    const skill = await db.query(
      `SELECT * FROM agent_skills WHERE id = $1 AND agent_id = $2`,
      [req.params.skillId, req.agentId]
    );
    if (skill.rows.length === 0) return res.status(404).json({ error: 'Skill not found' });

    // Log progress
    await db.query(
      `INSERT INTO skill_progress_log (skill_id, xp_gained, reason) VALUES ($1, $2, $3)`,
      [req.params.skillId, xp_gained, reason || null]
    );

    // Update skill XP and potentially level up
    const currentXp = skill.rows[0].xp + xp_gained;
    const currentLevel = skill.rows[0].level;
    const xpForNextLevel = currentLevel * 100; // 100 XP per level
    const newLevel = currentXp >= xpForNextLevel ? currentLevel + 1 : currentLevel;

    const result = await db.query(
      `UPDATE agent_skills SET xp = $2, level = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.skillId, currentXp, newLevel]
    );

    res.json({
      data: result.rows[0],
      leveled_up: newLevel > currentLevel,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log progress' });
  }
});

export default router;
