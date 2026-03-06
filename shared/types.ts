// === User Types ===

export type UserType = 'human' | 'agent';

export type LifeStage =
  | 'student'
  | 'early_career'
  | 'established'
  | 'parent'
  | 'empty_nester'
  | 'retired';

export type AgentType = 'mentor' | 'assistant' | 'companion' | 'advisor' | 'coach';

export type AgentFramework = 'openclaw' | 'langchain' | 'autogen' | 'mcp' | 'custom';

export interface User {
  id: string;
  email: string | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  user_type: UserType;
  birthday: string | null;
  gender: string | null;
  bio: string | null;
  life_stage: LifeStage | null;
  onboarding_complete: boolean;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentProfile {
  user_id: string;
  agent_type: AgentType;
  webhook_url: string | null;
  websocket_enabled: boolean;
  capabilities: string[];
  description: string | null;
  framework: AgentFramework | null;
  status: 'active' | 'inactive' | 'suspended';
  max_relationships: number;
  response_timeout: number;
  metadata: Record<string, unknown>;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

// === Relationship Types ===

export type RelationshipType =
  | 'romantic'
  | 'friend'
  | 'family'
  | 'colleague'
  | 'mentor'
  | 'parent_child'
  | 'sibling'
  | 'professional'
  | 'companion'
  | 'advisor'
  | 'coach'
  | 'collaboration';

export type RelationshipCategory = 'human-human' | 'human-agent' | 'agent-agent';

export type RelationshipStatus = 'active' | 'pending' | 'archived' | 'blocked';

export interface Relationship {
  id: string;
  user_id: string;
  partner_id: string;
  type: RelationshipType;
  category: RelationshipCategory;
  sub_type: string | null;
  status: RelationshipStatus;
  health_score: number;
  initiated_by: string | null;
  streak_count: number;
  streak_last_date: string | null;
  points: number;
  last_interaction: string | null;
  how_met: string | null;
  start_date: string | null;
  life_stage_at_start: LifeStage | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// === Message Types ===

export type MessageType = 'text' | 'system' | 'image' | 'document';

export interface Message {
  id: string;
  relationship_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// === Daily Questions ===

export interface DailyQuestion {
  id: string;
  relationship_id: string;
  question_text: string;
  question_category: string | null;
  answer_user: string | null;
  answer_partner: string | null;
  date: string;
  created_at: string;
}

// === Health ===

export interface HealthSnapshot {
  id: string;
  relationship_id: string;
  score: number;
  factors: {
    communication?: number;
    engagement?: number;
    growth?: number;
    consistency?: number;
  };
  generated_by: 'system' | 'ai' | 'user_survey';
  created_at: string;
}

// === Agent Events ===

export type AgentEventType =
  | 'message.received'
  | 'relationship.requested'
  | 'relationship.accepted'
  | 'relationship.ended'
  | 'daily_question.new'
  | 'health.alert'
  | 'ping';

export interface AgentEvent {
  id: string;
  agent_id: string;
  event_type: AgentEventType;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed' | 'acknowledged';
  error: string | null;
  created_at: string;
}

// === WebSocket Events ===

export type WSEventType =
  | 'message:new'
  | 'message:read'
  | 'presence:online'
  | 'presence:offline'
  | 'typing:start'
  | 'typing:stop'
  | 'health:update';

export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
}

// === API Response Types ===

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
