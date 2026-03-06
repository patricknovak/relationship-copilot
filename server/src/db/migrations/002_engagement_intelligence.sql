-- 002_engagement_intelligence.sql
-- Gamification, zodiac, goals, discover/matching, patterns, milestones

-- Achievement definitions
CREATE TABLE achievement_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  category    VARCHAR(30),       -- 'streak', 'communication', 'goal', 'agent', 'health'
  threshold   INT,               -- e.g., 7 for "7-day streak"
  points      INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- User achievements (earned — both humans and agents)
CREATE TABLE user_achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id  UUID NOT NULL REFERENCES achievement_definitions(id),
  earned_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

-- Goals (shared between relationship participants)
CREATE TABLE goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(30),   -- 'communication', 'quality_time', 'growth', 'conflict_resolution', 'milestone'
  status          VARCHAR(20) DEFAULT 'active',
  target_date     DATE,
  progress        INT DEFAULT 0, -- 0-100
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_goals_relationship ON goals(relationship_id);
CREATE INDEX idx_goals_user ON goals(user_id);

-- Zodiac profiles
CREATE TABLE zodiac_profiles (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  western_sign       VARCHAR(20),
  chinese_sign       VARCHAR(20),
  agent_archetype    VARCHAR(30),
  personality_traits JSONB DEFAULT '{}',
  computed_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Compatibility scores (cached)
CREATE TABLE compatibility_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  western_score   FLOAT,
  chinese_score   FLOAT,
  personality_score FLOAT,
  overall_score   FLOAT,
  details         JSONB DEFAULT '{}',
  computed_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, partner_id)
);

-- Discover profiles (humans AND agents are discoverable)
CREATE TABLE discover_profiles (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  visible            BOOLEAN DEFAULT true,
  looking_for        JSONB DEFAULT '[]',
  interests          JSONB DEFAULT '[]',
  location           VARCHAR(100),
  age_range_min      INT,
  age_range_max      INT,
  life_stage         VARCHAR(30),
  relationship_goals JSONB DEFAULT '[]',
  -- Agent-specific
  agent_skills       JSONB DEFAULT '[]',
  use_cases          JSONB DEFAULT '[]'
);

-- Swipe actions
CREATE TABLE swipe_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      VARCHAR(10) NOT NULL, -- 'like', 'pass'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id)
);

CREATE INDEX idx_swipe_actions_user ON swipe_actions(user_id);

-- Relationship patterns (AI-detected behavioral patterns)
CREATE TABLE relationship_patterns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  pattern_type    VARCHAR(30) NOT NULL,  -- 'communication_decline', 'conflict_cycle', 'growth_plateau', 'positive_trend', 'avoidance'
  description     TEXT,
  severity        VARCHAR(10),           -- 'info', 'warning', 'critical'
  suggestion      TEXT,
  acknowledged    BOOLEAN DEFAULT false,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patterns_relationship ON relationship_patterns(relationship_id);

-- Relationship milestones
CREATE TABLE milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  milestone_type  VARCHAR(30),  -- 'anniversary', 'goal_achieved', 'streak', 'health_improvement', 'custom'
  date            DATE NOT NULL,
  celebrated      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_milestones_relationship ON milestones(relationship_id);

-- Points history (track point transactions)
CREATE TABLE points_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INT NOT NULL,
  reason      VARCHAR(100) NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_history_user ON points_history(user_id);

-- Seed initial achievement definitions
INSERT INTO achievement_definitions (name, description, icon, category, threshold, points) VALUES
  ('First Connection', 'Create your first relationship', 'link', 'communication', 1, 10),
  ('Week Streak', 'Maintain a 7-day streak', 'fire', 'streak', 7, 25),
  ('Month Streak', 'Maintain a 30-day streak', 'fire', 'streak', 30, 100),
  ('Century Streak', 'Maintain a 100-day streak', 'fire', 'streak', 100, 500),
  ('Goal Setter', 'Create your first shared goal', 'target', 'goal', 1, 15),
  ('Goal Crusher', 'Complete 5 goals', 'trophy', 'goal', 5, 75),
  ('Agent Friend', 'Connect with your first AI agent', 'robot', 'agent', 1, 20),
  ('Social Butterfly', 'Have 10 active relationships', 'users', 'communication', 10, 50),
  ('Health Champion', 'Achieve 90+ health score on a relationship', 'heart', 'health', 90, 100),
  ('Communicator', 'Send 100 messages', 'message', 'communication', 100, 30),
  ('Deep Talker', 'Send 1000 messages', 'message', 'communication', 1000, 150),
  ('Zodiac Explorer', 'Check compatibility with 5 people', 'star', 'communication', 5, 20);
