// Hand-maintained subset of the Supabase schema (migrations 0001–0003).
// Replace with `supabase gen types typescript` output once a project exists.
// Shape matches what supabase-js expects (Tables with Relationships, plus
// Views/Functions/Enums/CompositeTypes) so query results type correctly.

export type ConnectionType =
  | "romantic" | "friend" | "family" | "coworker"
  | "parent_child" | "sibling" | "mentor";
export type ConnectionStatus =
  | "pending" | "onboarding" | "active" | "archived" | "blocked";
export type PromptKind = "onboarding" | "daily" | "quiz" | "challenge";

export type Json =
  | string | number | boolean | null
  | { [key: string]: Json | undefined } | Json[];

// Shape of a single question inside a template/instance `questions` array.
export interface PromptQuestion {
  id: string;
  text: string;
  format?: "free_text" | "scale" | "choice";
  options?: string[];
  min?: number;
  max?: number;
  dimension?: string;
}

export interface Database {
  // postgrest-js (2.106+) reads this to pick result-typing behavior.
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          birthday: string | null;
          life_stage: string | null;
          intake: Json;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          birthday?: string | null;
          intake?: Json;
          preferences?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      connections: {
        Row: {
          id: string;
          type: ConnectionType;
          sub_type: string | null;
          status: ConnectionStatus;
          created_by: string;
          invite_code: string | null;
          invite_expires_at: string | null;
          onboarding_done: boolean;
          life_stage: string | null;
          start_date: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          type: ConnectionType;
          created_by: string;
          sub_type?: string | null;
          invite_code?: string | null;
          invite_expires_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["connections"]["Insert"]
        > & {
          status?: ConnectionStatus;
          onboarding_done?: boolean;
          invite_code?: string | null;
        };
        Relationships: [];
      };
      connection_members: {
        Row: {
          connection_id: string;
          user_id: string;
          role: string;
          joined_at: string | null;
          onboarding_submitted: boolean;
        };
        Insert: {
          connection_id: string;
          user_id: string;
          role?: string;
          joined_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["connection_members"]["Insert"]
        >;
        Relationships: [];
      };
      prompt_templates: {
        Row: {
          id: string;
          kind: PromptKind;
          relationship_type: ConnectionType | null;
          framework: string | null;
          title: string | null;
          description: string | null;
          questions: PromptQuestion[];
          source: "seed" | "grok" | "user";
          config: Json;
          active: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      prompt_instances: {
        Row: {
          id: string;
          connection_id: string;
          template_id: string | null;
          kind: PromptKind;
          questions: PromptQuestion[];
          scheduled_for: string | null;
          status: "open" | "revealed" | "completed" | "skipped";
          revealed_at: string | null;
          created_at: string;
        };
        Insert: {
          connection_id: string;
          kind: PromptKind;
          questions: PromptQuestion[];
          template_id?: string | null;
          scheduled_for?: string | null;
          status?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["prompt_instances"]["Insert"]
        >;
        Relationships: [];
      };
      prompt_responses: {
        Row: {
          id: string;
          instance_id: string;
          user_id: string;
          answers: Json;
          submitted_at: string;
          edited_at: string | null;
        };
        Insert: {
          instance_id: string;
          user_id: string;
          answers: Json;
        };
        Update: { answers: Json; edited_at?: string | null };
        Relationships: [];
      };
      prompt_discussions: {
        Row: {
          id: string;
          instance_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: { instance_id: string; user_id: string; body: string };
        Update: never;
        Relationships: [];
      };
      education_articles: {
        Row: {
          id: string;
          slug: string;
          title: string;
          summary: string | null;
          body: string;
          category: string | null;
          relationship_type: ConnectionType | null;
          life_stage: string | null;
          framework: string | null;
          evidence_rating: number | null;
          is_premium: boolean;
          published: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          plan: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          updated_at: string;
        };
        Insert: { user_id: string; plan?: string; status?: string };
        Update: Partial<
          Database["public"]["Tables"]["subscriptions"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_invite: { Args: { p_code: string }; Returns: string };
      has_premium: { Args: { uid: string }; Returns: boolean };
    };
    Enums: {
      connection_type: ConnectionType;
      connection_status: ConnectionStatus;
      prompt_kind: PromptKind;
      prompt_source: "seed" | "grok" | "user";
    };
    CompositeTypes: { [_ in never]: never };
  };
}
