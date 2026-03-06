import { query } from '../db';

export async function getDiscoverProfiles(
  userId: string,
  filters: {
    type?: 'human' | 'agent';
    life_stage?: string;
    looking_for?: string;
    limit?: number;
    offset?: number;
  }
) {
  const params: unknown[] = [userId];
  let sql = `
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.user_type, u.bio, u.life_stage,
           dp.interests, dp.looking_for, dp.location, dp.relationship_goals,
           dp.agent_skills, dp.use_cases,
           ap.agent_type, ap.capabilities, ap.description as agent_description, ap.framework
    FROM users u
    JOIN discover_profiles dp ON dp.user_id = u.id AND dp.visible = true
    LEFT JOIN agent_profiles ap ON ap.user_id = u.id
    WHERE u.id != $1
      AND u.id NOT IN (SELECT target_id FROM swipe_actions WHERE user_id = $1)
      AND u.id NOT IN (SELECT partner_id FROM relationships WHERE user_id = $1)
  `;

  if (filters.type) {
    params.push(filters.type);
    sql += ` AND u.user_type = $${params.length}`;
  }

  if (filters.life_stage) {
    params.push(filters.life_stage);
    sql += ` AND (dp.life_stage = $${params.length} OR u.life_stage = $${params.length})`;
  }

  sql += ' ORDER BY u.created_at DESC';

  const limit = filters.limit || 20;
  const offset = filters.offset || 0;
  params.push(limit, offset);
  sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  return rows;
}

export async function recordSwipe(userId: string, targetId: string, action: 'like' | 'pass') {
  await query(
    `INSERT INTO swipe_actions (user_id, target_id, action) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, target_id) DO UPDATE SET action = $3`,
    [userId, targetId, action]
  );

  // Check for mutual match
  if (action === 'like') {
    const { rows } = await query(
      "SELECT id FROM swipe_actions WHERE user_id = $1 AND target_id = $2 AND action = 'like'",
      [targetId, userId]
    );
    return rows.length > 0; // true = mutual match!
  }

  return false;
}

export async function getMatches(userId: string) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.user_type, u.bio,
            sa.created_at as matched_at
     FROM swipe_actions sa
     JOIN users u ON u.id = sa.target_id
     WHERE sa.user_id = $1 AND sa.action = 'like'
       AND EXISTS (
         SELECT 1 FROM swipe_actions sa2
         WHERE sa2.user_id = sa.target_id AND sa2.target_id = $1 AND sa2.action = 'like'
       )
       AND NOT EXISTS (
         SELECT 1 FROM relationships r
         WHERE (r.user_id = $1 AND r.partner_id = sa.target_id)
            OR (r.user_id = sa.target_id AND r.partner_id = $1)
       )
     ORDER BY sa.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function upsertDiscoverProfile(
  userId: string,
  data: {
    visible?: boolean;
    looking_for?: string[];
    interests?: string[];
    location?: string;
    age_range_min?: number;
    age_range_max?: number;
    life_stage?: string;
    relationship_goals?: string[];
    agent_skills?: string[];
    use_cases?: string[];
  }
) {
  await query(
    `INSERT INTO discover_profiles (user_id, visible, looking_for, interests, location,
       age_range_min, age_range_max, life_stage, relationship_goals, agent_skills, use_cases)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id) DO UPDATE SET
       visible = COALESCE($2, discover_profiles.visible),
       looking_for = COALESCE($3, discover_profiles.looking_for),
       interests = COALESCE($4, discover_profiles.interests),
       location = COALESCE($5, discover_profiles.location),
       age_range_min = COALESCE($6, discover_profiles.age_range_min),
       age_range_max = COALESCE($7, discover_profiles.age_range_max),
       life_stage = COALESCE($8, discover_profiles.life_stage),
       relationship_goals = COALESCE($9, discover_profiles.relationship_goals),
       agent_skills = COALESCE($10, discover_profiles.agent_skills),
       use_cases = COALESCE($11, discover_profiles.use_cases)`,
    [
      userId,
      data.visible ?? true,
      JSON.stringify(data.looking_for || []),
      JSON.stringify(data.interests || []),
      data.location || null,
      data.age_range_min || null,
      data.age_range_max || null,
      data.life_stage || null,
      JSON.stringify(data.relationship_goals || []),
      JSON.stringify(data.agent_skills || []),
      JSON.stringify(data.use_cases || []),
    ]
  );
}
