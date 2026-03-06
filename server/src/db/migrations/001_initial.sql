-- 001_initial.sql
-- Foundation schema: users, agents, relationships, messages, sessions, events, daily questions, health

-- Users table (humans and agents are both first-class citizens)
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) UNIQUE,
  username          VARCHAR(50) UNIQUE NOT NULL,
  password_hash     VARCHAR(255),
  display_name      VARCHAR(100),
  avatar_url        TEXT,
  user_type         VARCHAR(20) NOT NULL DEFAULT 'human',
  birthday          DATE,
  gender            VARCHAR(30),
  bio               TEXT,
  life_stage        VARCHAR(30),
  onboarding_complete BOOLEAN DEFAULT false,
  preferences       JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Agent profiles (agents that connect via API)
CREATE TABLE agent_profiles (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  agent_type        VARCHAR(20) NOT NULL,
  api_key_hash      VARCHAR(255) NOT NULL,
  webhook_url       TEXT,
  websocket_enabled BOOLEAN DEFAULT false,
  capabilities      JSONB DEFAULT '[]',
  description       TEXT,
  framework         VARCHAR(50),
  status            VARCHAR(20) DEFAULT 'active',
  max_relationships INT DEFAULT 1000,
  response_timeout  INT DEFAULT 30000,
  metadata          JSONB DEFAULT '{}',
  owner_id          UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships (universal model for all types)
CREATE TABLE relationships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL,
  category        VARCHAR(20) NOT NULL,
  sub_type        VARCHAR(30),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  health_score    INT DEFAULT 50,
  initiated_by    UUID REFERENCES users(id),
  streak_count    INT DEFAULT 0,
  streak_last_date DATE,
  points          INT DEFAULT 0,
  last_interaction TIMESTAMPTZ,
  how_met         VARCHAR(50),
  start_date      DATE,
  life_stage_at_start VARCHAR(30),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, partner_id)
);

CREATE INDEX idx_relationships_user ON relationships(user_id);
CREATE INDEX idx_relationships_partner ON relationships(partner_id);
CREATE INDEX idx_relationships_status ON relationships(status);

-- Messages
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL,
  message_type    VARCHAR(20) DEFAULT 'text',
  metadata        JSONB DEFAULT '{}',
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_relationship ON messages(relationship_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Sessions (human auth)
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(500) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Agent events (event delivery tracking)
CREATE TABLE agent_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  VARCHAR(30) NOT NULL,
  payload     JSONB DEFAULT '{}',
  status      VARCHAR(20) DEFAULT 'pending',
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_events_agent ON agent_events(agent_id, status);

-- Daily questions
CREATE TABLE daily_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  question_category VARCHAR(30),
  answer_user     TEXT,
  answer_partner  TEXT,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(relationship_id, date)
);

-- Relationship health snapshots
CREATE TABLE health_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  score           INT NOT NULL,
  factors         JSONB DEFAULT '{}',
  generated_by    VARCHAR(20) DEFAULT 'system',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_snapshots_relationship ON health_snapshots(relationship_id, created_at DESC);
