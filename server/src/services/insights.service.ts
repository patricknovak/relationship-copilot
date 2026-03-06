import { db } from '../db';

export async function generateInsightsForUser(userId: string): Promise<void> {
  // Analyze relationships and generate predictive insights
  const relationships = await db.query(
    `SELECT r.*, u.username AS partner_username, u.display_name AS partner_display_name
     FROM relationships r
     JOIN users u ON u.id = r.partner_id
     WHERE r.user_id = $1 AND r.status = 'active'`,
    [userId]
  );

  for (const rel of relationships.rows) {
    await analyzeRelationship(userId, rel);
  }
}

async function analyzeRelationship(userId: string, rel: Record<string, unknown>): Promise<void> {
  const relId = rel.id as string;
  const partnerName = (rel.partner_display_name || rel.partner_username) as string;
  const healthScore = (rel.health_score as number) || 50;
  const relType = rel.type as string;

  // Check for declining health
  const healthHistory = await db.query(
    `SELECT score, recorded_at FROM health_snapshots
     WHERE relationship_id = $1 ORDER BY recorded_at DESC LIMIT 5`,
    [relId]
  );

  if (healthHistory.rows.length >= 3) {
    const scores = healthHistory.rows.map((r: { score: number }) => r.score);
    const isDecline = scores[0] < scores[1] && scores[1] < scores[2];

    if (isDecline && scores[0] < 50) {
      await upsertInsight(userId, relId, 'health_decline', 'warning',
        `Declining health with ${partnerName}`,
        `Your relationship health has been declining over the last 3 check-ins (${scores[2]} → ${scores[1]} → ${scores[0]}). This trend may indicate unresolved issues.`,
        'Consider having an open conversation about what is affecting the relationship, or start a coaching session for guidance.'
      );
    }
  }

  // Check for communication gaps
  const recentMessages = await db.query(
    `SELECT COUNT(*) AS count FROM messages
     WHERE relationship_id = $1 AND created_at > NOW() - INTERVAL '14 days'`,
    [relId]
  );

  const msgCount = parseInt(recentMessages.rows[0].count, 10);
  if (msgCount === 0) {
    await upsertInsight(userId, relId, 'communication_gap', 'warning',
      `No recent contact with ${partnerName}`,
      `You haven't exchanged messages with ${partnerName} in over 2 weeks. Regular communication is key to maintaining healthy relationships.`,
      `Send a simple check-in message to reconnect. Even a brief "thinking of you" can strengthen your bond.`
    );
  }

  // Check for very low health
  if (healthScore < 30) {
    await upsertInsight(userId, relId, 'critical_health', 'critical',
      `Relationship with ${partnerName} needs attention`,
      `Your health score (${healthScore}/100) is critically low. This relationship may be at risk without intervention.`,
      `Consider using the exit planning tool if this relationship is harmful, or start a coaching session to work through challenges.`
    );
  }

  // Check for milestone opportunities
  const relCreatedAt = new Date(rel.created_at as string);
  const daysSinceStart = Math.floor((Date.now() - relCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

  const milestoneThresholds = [30, 90, 180, 365, 730, 1825];
  for (const threshold of milestoneThresholds) {
    if (daysSinceStart >= threshold - 7 && daysSinceStart <= threshold) {
      const label = threshold < 365
        ? `${threshold} days`
        : `${Math.floor(threshold / 365)} year${threshold >= 730 ? 's' : ''}`;

      await upsertInsight(userId, relId, 'milestone_approaching', 'info',
        `${label} milestone with ${partnerName}`,
        `You are approaching ${label} in your ${relType} relationship with ${partnerName}. Celebrating milestones strengthens bonds.`,
        `Plan something special to mark this occasion. Even a thoughtful message acknowledging this milestone can mean a lot.`
      );
    }
  }

  // Positive insight for high health
  if (healthScore >= 85) {
    await upsertInsight(userId, relId, 'thriving', 'info',
      `Thriving with ${partnerName}`,
      `Your relationship health score is ${healthScore}/100 — excellent! Keep doing what you're doing.`,
      `Consider sharing what works well in this relationship by writing a wiki article to help others.`
    );
  }

  // Check-in frequency analysis
  const checkIns = await db.query(
    `SELECT COUNT(*) AS count FROM check_in_responses
     WHERE relationship_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
    [relId]
  );

  const checkInCount = parseInt(checkIns.rows[0].count, 10);
  if (checkInCount === 0 && healthScore < 70) {
    await upsertInsight(userId, relId, 'check_in_needed', 'info',
      `Time for a check-in with ${partnerName}`,
      `You haven't completed a check-in survey for this relationship in the past month. Regular check-ins help track progress.`,
      `Complete a weekly or monthly check-in to better understand where your relationship stands.`
    );
  }
}

async function upsertInsight(
  userId: string,
  relationshipId: string,
  insightType: string,
  severity: string,
  title: string,
  description: string,
  recommendation: string
): Promise<void> {
  // Don't create duplicate active insights
  const existing = await db.query(
    `SELECT id FROM insights
     WHERE user_id = $1 AND relationship_id = $2 AND insight_type = $3 AND status = 'active'`,
    [userId, relationshipId, insightType]
  );

  if (existing.rows.length > 0) return;

  await db.query(
    `INSERT INTO insights (user_id, relationship_id, insight_type, severity, title, description, recommendation)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, relationshipId, insightType, severity, title, description, recommendation]
  );
}
