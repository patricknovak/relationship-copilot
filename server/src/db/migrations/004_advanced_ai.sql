-- Phase 4: Advanced AI & Agent Ecosystem

-- Predictive insights
CREATE TABLE insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  relationship_id UUID REFERENCES relationships(id),
  insight_type    VARCHAR(30) NOT NULL,
  severity        VARCHAR(20) DEFAULT 'info',
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  recommendation  TEXT,
  data            JSONB DEFAULT '{}',
  status          VARCHAR(20) DEFAULT 'active',
  dismissed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insights_user ON insights(user_id, status, created_at DESC);
CREATE INDEX idx_insights_relationship ON insights(relationship_id, created_at DESC);

-- Check-in surveys
CREATE TABLE check_in_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  questions         JSONB NOT NULL,
  frequency         VARCHAR(20) DEFAULT 'weekly',
  relationship_type VARCHAR(30),
  life_stage        VARCHAR(30),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE check_in_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES check_in_templates(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  relationship_id UUID REFERENCES relationships(id),
  answers         JSONB NOT NULL,
  mood_score      INT CHECK (mood_score >= 1 AND mood_score <= 10),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_check_in_responses_user ON check_in_responses(user_id, created_at DESC);
CREATE INDEX idx_check_in_responses_relationship ON check_in_responses(relationship_id, created_at DESC);

-- Agent collaboration (agent-to-agent relationships and shared tasks)
CREATE TABLE agent_collaborations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID NOT NULL REFERENCES users(id),
  partner_id   UUID NOT NULL REFERENCES users(id),
  purpose      TEXT,
  status       VARCHAR(20) DEFAULT 'active',
  shared_data  JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(initiator_id, partner_id)
);

CREATE TABLE collaboration_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id UUID NOT NULL REFERENCES agent_collaborations(id),
  assigned_to      UUID NOT NULL REFERENCES users(id),
  task_type        VARCHAR(50) NOT NULL,
  description      TEXT,
  input_data       JSONB DEFAULT '{}',
  output_data      JSONB DEFAULT '{}',
  status           VARCHAR(20) DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX idx_collaboration_tasks_collab ON collaboration_tasks(collaboration_id, status);

-- Agent skill development
CREATE TABLE agent_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES users(id),
  skill_name  VARCHAR(100) NOT NULL,
  category    VARCHAR(30),
  level       INT DEFAULT 1 CHECK (level >= 1 AND level <= 10),
  xp          INT DEFAULT 0,
  milestones  JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, skill_name)
);

CREATE TABLE skill_progress_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id   UUID NOT NULL REFERENCES agent_skills(id),
  xp_gained  INT NOT NULL,
  reason     VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationship timeline (key events across the relationship)
CREATE TABLE relationship_timeline (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id),
  event_type      VARCHAR(50) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  data            JSONB DEFAULT '{}',
  event_date      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_relationship_timeline ON relationship_timeline(relationship_id, event_date DESC);

-- Seed data: check-in templates
INSERT INTO check_in_templates (title, description, questions, frequency, relationship_type) VALUES
('Weekly Relationship Check-In', 'A quick weekly pulse on your relationship health', '[
  {"q": "How connected did you feel to this person this week?", "type": "scale", "min": 1, "max": 10},
  {"q": "How effectively did you communicate this week?", "type": "scale", "min": 1, "max": 10},
  {"q": "Did any conflicts arise? How were they handled?", "type": "text"},
  {"q": "What was the highlight of your relationship this week?", "type": "text"},
  {"q": "What is one thing you would like to improve next week?", "type": "text"}
]', 'weekly', NULL),

('Monthly Deep Dive', 'A thorough monthly reflection on your relationship', '[
  {"q": "Overall relationship satisfaction this month", "type": "scale", "min": 1, "max": 10},
  {"q": "How well are you both growing individually?", "type": "scale", "min": 1, "max": 10},
  {"q": "How aligned are your goals and values?", "type": "scale", "min": 1, "max": 10},
  {"q": "Rate the quality of your communication", "type": "scale", "min": 1, "max": 10},
  {"q": "What patterns have you noticed this month?", "type": "text"},
  {"q": "What are you grateful for in this relationship?", "type": "text"},
  {"q": "What needs more attention?", "type": "text"},
  {"q": "What is one commitment you want to make for next month?", "type": "text"}
]', 'monthly', NULL),

('Daily Mood Check', 'A quick daily emotional pulse', '[
  {"q": "How are you feeling right now?", "type": "scale", "min": 1, "max": 10},
  {"q": "Did you have a meaningful interaction today?", "type": "boolean"},
  {"q": "One word to describe your relationship today", "type": "text"}
]', 'daily', NULL),

('Parent-Child Connection Check', 'Weekly check-in for your parenting relationship', '[
  {"q": "How connected did you feel to your child this week?", "type": "scale", "min": 1, "max": 10},
  {"q": "How many quality one-on-one moments did you have?", "type": "scale", "min": 0, "max": 10},
  {"q": "What did your child teach you this week?", "type": "text"},
  {"q": "What challenge came up and how did you handle it?", "type": "text"},
  {"q": "What activity would you like to do together next week?", "type": "text"}
]', 'weekly', 'parent_child'),

('Professional Relationship Review', 'Monthly reflection on a work relationship', '[
  {"q": "How productive is this professional relationship?", "type": "scale", "min": 1, "max": 10},
  {"q": "How much mutual respect exists?", "type": "scale", "min": 1, "max": 10},
  {"q": "Are expectations clear on both sides?", "type": "scale", "min": 1, "max": 10},
  {"q": "What value does this relationship bring to your career?", "type": "text"},
  {"q": "How could collaboration be improved?", "type": "text"}
]', 'monthly', 'professional');
