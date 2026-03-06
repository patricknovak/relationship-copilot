-- Phase 3: Community, Coaching & Life Stages

-- Wiki articles
CREATE TABLE wiki_articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES users(id),
  title       VARCHAR(300) NOT NULL,
  content     TEXT NOT NULL,
  category    VARCHAR(30),
  tags        JSONB DEFAULT '[]',
  upvotes     INT DEFAULT 0,
  status      VARCHAR(20) DEFAULT 'published',
  life_stage  VARCHAR(30),
  relationship_type VARCHAR(30),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wiki_articles_category ON wiki_articles(category);
CREATE INDEX idx_wiki_articles_life_stage ON wiki_articles(life_stage);

-- Wiki votes
CREATE TABLE wiki_votes (
  user_id    UUID NOT NULL REFERENCES users(id),
  article_id UUID NOT NULL REFERENCES wiki_articles(id),
  vote       SMALLINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(user_id, article_id)
);

-- Wiki comments
CREATE TABLE wiki_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES wiki_articles(id),
  author_id  UUID NOT NULL REFERENCES users(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wiki_comments_article ON wiki_comments(article_id, created_at);

-- Quizzes (relationship assessments)
CREATE TABLE quizzes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             VARCHAR(300) NOT NULL,
  description       TEXT,
  questions         JSONB NOT NULL,
  category          VARCHAR(30),
  relationship_type VARCHAR(30),
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      UUID NOT NULL REFERENCES quizzes(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  score        INT,
  result_type  VARCHAR(50),
  answers      JSONB,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_results_user ON quiz_results(user_id);

-- Coaching sessions
CREATE TABLE coaching_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  agent_id        UUID NOT NULL REFERENCES users(id),
  relationship_id UUID REFERENCES relationships(id),
  topic           VARCHAR(200),
  category        VARCHAR(30),
  status          VARCHAR(20) DEFAULT 'active',
  session_data    JSONB DEFAULT '{}',
  goals           JSONB DEFAULT '[]',
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  summary         TEXT
);

CREATE INDEX idx_coaching_sessions_user ON coaching_sessions(user_id, status);
CREATE INDEX idx_coaching_sessions_agent ON coaching_sessions(agent_id, status);

-- Life stage transitions
CREATE TABLE life_stage_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  from_stage VARCHAR(30),
  to_stage   VARCHAR(30) NOT NULL,
  event_type VARCHAR(50),
  notes      TEXT,
  date       DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_life_stage_events_user ON life_stage_events(user_id, date DESC);

-- Life stage guidance (system content)
CREATE TABLE life_stage_guides (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  life_stage         VARCHAR(30) NOT NULL,
  event_type         VARCHAR(50),
  title              VARCHAR(200) NOT NULL,
  content            TEXT NOT NULL,
  relationship_types JSONB DEFAULT '[]',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  type       VARCHAR(30) NOT NULL,
  title      VARCHAR(200),
  body       TEXT,
  data       JSONB DEFAULT '{}',
  read       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- Audit log
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,
  resource    VARCHAR(50),
  resource_id UUID,
  details     JSONB DEFAULT '{}',
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);

-- Agent reviews
CREATE TABLE agent_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES users(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  rating      SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, reviewer_id)
);

-- Agent tools (MCP-style capability declaration)
CREATE TABLE agent_tools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES users(id),
  tool_name   VARCHAR(100) NOT NULL,
  description TEXT,
  input_schema JSONB,
  category    VARCHAR(30),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, tool_name)
);

-- Relationship exit plans
CREATE TABLE exit_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  relationship_id     UUID NOT NULL REFERENCES relationships(id),
  reason              TEXT,
  steps               JSONB DEFAULT '[]',
  resources           JSONB DEFAULT '[]',
  status              VARCHAR(20) DEFAULT 'active',
  coaching_session_id UUID REFERENCES coaching_sessions(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_exit_plans_user ON exit_plans(user_id, status);

-- Seed data: built-in quizzes
INSERT INTO quizzes (id, title, description, questions, category) VALUES
(gen_random_uuid(), 'Love Language Assessment', 'Discover how you prefer to give and receive love', '[
  {"q": "When you feel most loved, it is usually because someone...", "options": ["Told you they love you", "Gave you a thoughtful gift", "Spent quality time with you", "Did something helpful for you", "Gave you a hug or held your hand"], "categories": ["words", "gifts", "time", "service", "touch"]},
  {"q": "You feel most appreciated at work when your boss...", "options": ["Praises your effort verbally", "Gives you a bonus or reward", "Takes time to meet with you one-on-one", "Helps you with a difficult task", "Gives you a pat on the back"], "categories": ["words", "gifts", "time", "service", "touch"]},
  {"q": "On your birthday, what matters most is...", "options": ["Heartfelt cards and messages", "The perfect gift", "A day spent together", "Someone planning it all for you", "Lots of hugs"], "categories": ["words", "gifts", "time", "service", "touch"]},
  {"q": "When you are stressed, you most want someone to...", "options": ["Tell you everything will be okay", "Bring you comfort food or a treat", "Sit with you quietly", "Take something off your plate", "Hold you close"], "categories": ["words", "gifts", "time", "service", "touch"]},
  {"q": "In a relationship, you feel most disconnected when...", "options": ["Your partner rarely says kind things", "You never receive surprises", "You rarely spend meaningful time together", "Your partner never helps out", "There is a lack of physical affection"], "categories": ["words", "gifts", "time", "service", "touch"]}
]', 'love_language'),

(gen_random_uuid(), 'Attachment Style Quiz', 'Understand your attachment patterns in relationships', '[
  {"q": "When my partner is away, I...", "options": ["Feel comfortable and trust they will return", "Feel anxious and check in frequently", "Feel relieved to have space", "Alternate between wanting closeness and pushing away"], "categories": ["secure", "anxious", "avoidant", "disorganized"]},
  {"q": "When conflict arises, I typically...", "options": ["Address it calmly and seek resolution", "Become very worried about the relationship", "Withdraw and need space", "Feel overwhelmed and react unpredictably"], "categories": ["secure", "anxious", "avoidant", "disorganized"]},
  {"q": "I find it easy to depend on others.", "options": ["Yes, when appropriate", "I want to but worry they will let me down", "No, I prefer to handle things myself", "Sometimes yes, sometimes it terrifies me"], "categories": ["secure", "anxious", "avoidant", "disorganized"]},
  {"q": "When I need emotional support, I...", "options": ["Ask for it directly", "Drop hints and hope they notice", "Keep it to myself", "Want it but feel scared to ask"], "categories": ["secure", "anxious", "avoidant", "disorganized"]},
  {"q": "My view of relationships is generally...", "options": ["Positive — they enrich my life", "Hopeful but anxious — I fear abandonment", "Cautious — I value independence more", "Complicated — I want closeness but fear it"], "categories": ["secure", "anxious", "avoidant", "disorganized"]}
]', 'attachment_style'),

(gen_random_uuid(), 'Communication Style Assessment', 'Learn how you communicate in relationships', '[
  {"q": "When sharing your feelings, you tend to...", "options": ["Express them clearly and directly", "Hint at them indirectly", "Keep them private until asked", "Express through actions not words"], "categories": ["direct", "indirect", "reserved", "action-oriented"]},
  {"q": "In a disagreement, you usually...", "options": ["State your position firmly but respectfully", "Try to smooth things over quickly", "Go quiet and process internally", "Focus on solving the problem practically"], "categories": ["direct", "indirect", "reserved", "action-oriented"]},
  {"q": "When someone shares a problem with you, you...", "options": ["Offer honest feedback even if hard to hear", "Validate their feelings first", "Listen quietly without much response", "Suggest practical solutions"], "categories": ["direct", "indirect", "reserved", "action-oriented"]},
  {"q": "Your ideal conversation style is...", "options": ["Open, honest, and straightforward", "Warm, empathetic, and flowing", "Thoughtful, measured, and private", "Brief, practical, and results-focused"], "categories": ["direct", "indirect", "reserved", "action-oriented"]}
]', 'communication_style');

-- Seed data: life stage guides
INSERT INTO life_stage_guides (life_stage, event_type, title, content, relationship_types) VALUES
('early_career', NULL, 'Building Your Professional Network', 'Early in your career, building genuine professional relationships is crucial. Focus on finding mentors who can guide your growth, and be a reliable colleague who follows through on commitments. Remember that professional relationships built now often become lifelong connections.', '["colleague", "mentor", "professional"]'),
('early_career', 'job_change', 'Navigating a Career Move', 'Changing jobs affects your professional relationships. Maintain connections with former colleagues, be transparent with close work friends about your move, and approach new coworkers with openness. A job change is also a chance to reassess which professional relationships to invest in.', '["colleague", "professional"]'),
('parent', 'new_baby', 'Maintaining Relationships as a New Parent', 'A new baby transforms every relationship in your life. With your partner: schedule intentional couple time, communicate needs explicitly, and divide responsibilities fairly. With friends: accept that some friendships will shift, and be honest about your availability. With family: set boundaries around parenting advice while appreciating support.', '["romantic", "friend", "family"]'),
('parent', NULL, 'The Parenting Journey', 'Parenting is the most transformative relationship experience. Each stage brings new challenges: the early years demand patience and consistency, the school years require balancing guidance with growing independence, and the teenage years call for trust and open communication. Through it all, remember that your relationship with your child is built daily through small moments.', '["parent_child", "family"]'),
('established', 'marriage', 'Strengthening Your Marriage', 'Marriage is a commitment to continuous growth together. Keep investing in your connection through regular date nights, honest communication about needs and dreams, and shared goals that evolve over time. The strongest marriages are those where both partners keep choosing each other daily.', '["romantic"]'),
('established', 'divorce', 'Navigating Separation with Grace', 'Ending a marriage is one of life''s most difficult transitions. Prioritize your wellbeing and seek support from friends, family, or professionals. If children are involved, focus on co-parenting effectively. Remember that this ending can be a beginning — many people find deeper, healthier relationships after learning from past ones.', '["romantic", "family", "parent_child"]'),
('empty_nester', NULL, 'Rediscovering Relationships After Kids Leave', 'When children leave home, relationships shift dramatically. With your partner: rediscover each other beyond parenting roles. With your adult children: transition from authority figure to advisor and friend. With friends: reconnect with friendships that may have taken a backseat during the parenting years. This is a time of relationship renewal.', '["romantic", "parent_child", "friend"]'),
('retired', NULL, 'Relationships in Retirement', 'Retirement opens new relationship possibilities. Deepen friendships through shared activities, invest in family relationships with more available time, and consider mentoring younger people. Watch for isolation — maintaining social connections is vital for health and happiness in retirement.', '["friend", "family", "mentor"]'),
('student', NULL, 'Building Relationships in School', 'Your school years are a crucial time for learning relationship skills. Practice being a good friend, learn to navigate conflicts constructively, and explore different types of connections. The communication patterns you develop now will shape all your future relationships.', '["friend", "romantic", "mentor"]');
