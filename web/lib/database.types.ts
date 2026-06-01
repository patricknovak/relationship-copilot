// Hand-maintained subset of the Supabase schema (migrations 0001–0003).
// Replace with `supabase gen types typescript` output once a project exists.
// Only the tables used by the app so far are fully typed; more are added as
// features land.

export type ConnectionType =
  | "romantic" | "friend" | "family" | "coworker"
  | "parent_child" | "sibling" | "mentor";
export type ConnectionStatus =
  | "pending" | "onboarding" | "active" | "archived" | "blocked";
export type PromptKind = "onboarding" | "daily" | "quiz" | "challenge";

export type Json =
  | string | number | boolean | null
  | { [key: string]: Json | undefined } | Json[];

export interface Database {
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
        Update: Partial<Database["public"]["Tables"]["connections"]["Insert"]>;
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
        Update: Partial<Database["public"]["Tables"]["connection_members"]["Insert"]>;
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
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
    };
    Functions: {
      accept_invite: { Args: { p_code: string }; Returns: string };
      has_premium: { Args: { uid: string }; Returns: boolean };
    };
  };
}
