export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      orgs: {
        Row: {
          id: string;
          slug: string;
          name: string;
          plan: string;
          ai_tokens_used: number;
          ai_cost_inr: number;
          active_channel: string;
          channel_config: Json;
          onboarding_completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          plan?: string;
          ai_tokens_used?: number;
          ai_cost_inr?: number;
          active_channel?: string;
          channel_config?: Json;
          onboarding_completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          plan?: string;
          ai_tokens_used?: number;
          ai_cost_inr?: number;
          active_channel?: string;
          channel_config?: Json;
          onboarding_completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      org_members: {
        Row: {
          org_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          created_at: string;
        };
        Insert: {
          org_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member";
          created_at?: string;
        };
        Update: {
          org_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member";
          created_at?: string;
        };
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          org_id: string;
          provider: string;
          config: Json;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          provider: string;
          config?: Json;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          provider?: string;
          config?: Json;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      voice_profiles: {
        Row: {
          id: string;
          org_id: string;
          tone: string;
          offer: string;
          price_range: string;
          sells: string;
          objections: Json;
          extra_context: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          tone?: string;
          offer?: string;
          price_range?: string;
          sells?: string;
          objections?: Json;
          extra_context?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          tone?: string;
          offer?: string;
          price_range?: string;
          sells?: string;
          objections?: Json;
          extra_context?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          org_id: string;
          score: number;
          stage: "new" | "qualified" | "booked" | "paid" | "churned";
          source: string;
          instagram_handle: string | null;
          name: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          score?: number;
          stage?: "new" | "qualified" | "booked" | "paid" | "churned";
          source?: string;
          instagram_handle?: string | null;
          name?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          score?: number;
          stage?: "new" | "qualified" | "booked" | "paid" | "churned";
          source?: string;
          instagram_handle?: string | null;
          name?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          org_id: string;
          lead_id: string;
          channel_provider: string;
          messages: Json;
          last_message_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          lead_id: string;
          channel_provider?: string;
          messages?: Json;
          last_message_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          lead_id?: string;
          channel_provider?: string;
          messages?: Json;
          last_message_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          org_id: string;
          lead_id: string;
          cal_event_id: string | null;
          status: "pending" | "confirmed" | "no_show" | "completed" | "cancelled";
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          lead_id: string;
          cal_event_id?: string | null;
          status?: "pending" | "confirmed" | "no_show" | "completed" | "cancelled";
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          lead_id?: string;
          cal_event_id?: string | null;
          status?: "pending" | "confirmed" | "no_show" | "completed" | "cancelled";
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          org_id: string;
          lead_id: string;
          amount_inr: number;
          status: "pending" | "paid" | "failed" | "refunded";
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          lead_id: string;
          amount_inr?: number;
          status?: "pending" | "paid" | "failed" | "refunded";
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          lead_id?: string;
          amount_inr?: number;
          status?: "pending" | "paid" | "failed" | "refunded";
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      sequences: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          trigger: string;
          steps: Json;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          trigger: string;
          steps?: Json;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          trigger?: string;
          steps?: Json;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      metrics_daily: {
        Row: {
          id: string;
          org_id: string;
          date: string;
          dms_received: number;
          leads_qualified: number;
          bookings_created: number;
          revenue_inr: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          date: string;
          dms_received?: number;
          leads_qualified?: number;
          bookings_created?: number;
          revenue_inr?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          date?: string;
          dms_received?: number;
          leads_qualified?: number;
          bookings_created?: number;
          revenue_inr?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          org_id: string;
          type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          type: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          type?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_org_member: {
        Args: { check_org_id: string };
        Returns: boolean;
      };
      is_org_owner: {
        Args: { check_org_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience row types
export type Org = Database["public"]["Tables"]["orgs"]["Row"];
export type OrgMember = Database["public"]["Tables"]["org_members"]["Row"];
export type Integration = Database["public"]["Tables"]["integrations"]["Row"];
export type VoiceProfile = Database["public"]["Tables"]["voice_profiles"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Sequence = Database["public"]["Tables"]["sequences"]["Row"];
export type MetricsDaily = Database["public"]["Tables"]["metrics_daily"]["Row"];
export type OrgEvent = Database["public"]["Tables"]["events"]["Row"];
