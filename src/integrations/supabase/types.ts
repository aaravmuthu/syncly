export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          group_id: string | null
          id: string
          message: string
          plan_id: string | null
          type: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          message: string
          plan_id?: string | null
          type: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          message?: string
          plan_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          profile_id: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          profile_id: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_preferences: {
        Row: {
          avg_spend_max: number | null
          avg_spend_min: number | null
          common_locations: Json
          favorite_activities: Json
          favorite_places: Json
          group_id: string
          typical_travel_minutes: number | null
          updated_at: string
        }
        Insert: {
          avg_spend_max?: number | null
          avg_spend_min?: number | null
          common_locations?: Json
          favorite_activities?: Json
          favorite_places?: Json
          group_id: string
          typical_travel_minutes?: number | null
          updated_at?: string
        }
        Update: {
          avg_spend_max?: number | null
          avg_spend_min?: number | null
          common_locations?: Json
          favorite_activities?: Json
          favorite_places?: Json
          group_id?: string
          typical_travel_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_preferences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          emoji: string
          id: string
          invite_code: string
          kind: Database["public"]["Enums"]["group_kind"]
          name: string
          purpose: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          emoji?: string
          id?: string
          invite_code?: string
          kind?: Database["public"]["Enums"]["group_kind"]
          name: string
          purpose?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          emoji?: string
          id?: string
          invite_code?: string
          kind?: Database["public"]["Enums"]["group_kind"]
          name?: string
          purpose?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          group_id: string | null
          id: string
          plan_id: string | null
          profile_id: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          plan_id?: string | null
          profile_id: string
          read?: boolean
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          plan_id?: string | null
          profile_id?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_approvals: {
        Row: {
          condition_text: string | null
          created_at: string
          expires_at: string
          id: string
          parent_email: string | null
          parent_name: string | null
          plan_id: string
          profile_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["approval_status"]
          token: string
        }
        Insert: {
          condition_text?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          parent_email?: string | null
          parent_name?: string | null
          plan_id: string
          profile_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          token?: string
        }
        Update: {
          condition_text?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          parent_email?: string | null
          parent_name?: string | null
          plan_id?: string
          profile_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_approvals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_approvals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_constraints: {
        Row: {
          created_at: string
          id: string
          payload: Json
          plan_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          plan_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          plan_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_constraints_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_constraints_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_participants: {
        Row: {
          attending: boolean
          created_at: string
          id: string
          plan_id: string
          profile_id: string
          responded: boolean
        }
        Insert: {
          attending?: boolean
          created_at?: string
          id?: string
          plan_id: string
          profile_id: string
          responded?: boolean
        }
        Update: {
          attending?: boolean
          created_at?: string
          id?: string
          plan_id?: string
          profile_id?: string
          responded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plan_participants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          category: string
          compatibility_score: number | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          location_area: string | null
          notes: string | null
          selected_recommendation_id: string | null
          status: Database["public"]["Enums"]["plan_status"]
          title: string
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          category: string
          compatibility_score?: number | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          location_area?: string | null
          notes?: string | null
          selected_recommendation_id?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          title: string
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          category?: string
          compatibility_score?: number | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          location_area?: string | null
          notes?: string | null
          selected_recommendation_id?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          title?: string
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          avatar_emoji: string
          budget_preference: string | null
          created_at: string
          curfew_time: string | null
          display_name: string
          home_area: string | null
          id: string
          independence_level: string | null
          is_demo: boolean
          needs_transportation: boolean
          notifications_enabled: boolean
          onboarded: boolean
          parent_approval_required: boolean
          parent_features_enabled: boolean
          personalization_enabled: boolean
          preferred_categories: string[]
          theme_preference: string
          transport_features_enabled: boolean
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          age?: number | null
          avatar_emoji?: string
          budget_preference?: string | null
          created_at?: string
          curfew_time?: string | null
          display_name?: string
          home_area?: string | null
          id?: string
          independence_level?: string | null
          is_demo?: boolean
          needs_transportation?: boolean
          notifications_enabled?: boolean
          onboarded?: boolean
          parent_approval_required?: boolean
          parent_features_enabled?: boolean
          personalization_enabled?: boolean
          preferred_categories?: string[]
          theme_preference?: string
          transport_features_enabled?: boolean
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          age?: number | null
          avatar_emoji?: string
          budget_preference?: string | null
          created_at?: string
          curfew_time?: string | null
          display_name?: string
          home_area?: string | null
          id?: string
          independence_level?: string | null
          is_demo?: boolean
          needs_transportation?: boolean
          notifications_enabled?: boolean
          onboarded?: boolean
          parent_approval_required?: boolean
          parent_features_enabled?: boolean
          personalization_enabled?: boolean
          preferred_categories?: string[]
          theme_preference?: string
          transport_features_enabled?: boolean
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          breakdown: Json
          category: string | null
          cost_max: number | null
          cost_min: number | null
          created_at: string
          feasible: boolean
          id: string
          location_name: string | null
          plan_id: string
          rank: number
          score: number
          subtitle: string | null
          suggested_end: string | null
          suggested_start: string | null
          tags: string[]
          title: string
          travel_minutes: number | null
        }
        Insert: {
          breakdown?: Json
          category?: string | null
          cost_max?: number | null
          cost_min?: number | null
          created_at?: string
          feasible?: boolean
          id?: string
          location_name?: string | null
          plan_id: string
          rank?: number
          score?: number
          subtitle?: string | null
          suggested_end?: string | null
          suggested_start?: string | null
          tags?: string[]
          title: string
          travel_minutes?: number | null
        }
        Update: {
          breakdown?: Json
          category?: string | null
          cost_max?: number | null
          cost_min?: number | null
          created_at?: string
          feasible?: boolean
          id?: string
          location_name?: string | null
          plan_id?: string
          rank?: number
          score?: number
          subtitle?: string | null
          suggested_end?: string | null
          suggested_start?: string | null
          tags?: string[]
          title?: string
          travel_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_assignments: {
        Row: {
          car_label: string
          created_at: string
          driver_label: string | null
          driver_profile_id: string | null
          id: string
          leg: string
          passenger_profile_ids: string[]
          plan_id: string
        }
        Insert: {
          car_label: string
          created_at?: string
          driver_label?: string | null
          driver_profile_id?: string | null
          id?: string
          leg?: string
          passenger_profile_ids?: string[]
          plan_id: string
        }
        Update: {
          car_label?: string
          created_at?: string
          driver_label?: string | null
          driver_profile_id?: string | null
          id?: string
          leg?: string
          passenger_profile_ids?: string[]
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_assignments_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_profiles: {
        Row: {
          can_drive: boolean
          has_car: boolean
          max_drive_minutes: number | null
          needs_ride: boolean
          parent_can_drive: boolean
          passenger_capacity: number
          profile_id: string
          required_return_time: string | null
          updated_at: string
        }
        Insert: {
          can_drive?: boolean
          has_car?: boolean
          max_drive_minutes?: number | null
          needs_ride?: boolean
          parent_can_drive?: boolean
          passenger_capacity?: number
          profile_id: string
          required_return_time?: string | null
          updated_at?: string
        }
        Update: {
          can_drive?: boolean
          has_car?: boolean
          max_drive_minutes?: number | null
          needs_ride?: boolean
          parent_can_drive?: boolean
          passenger_capacity?: number
          profile_id?: string
          required_return_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          profile_id: string
          recommendation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          profile_id: string
          recommendation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          profile_id?: string
          recommendation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_plan: { Args: { _plan_id: string }; Returns: boolean }
      gen_invite_code: { Args: never; Returns: string }
      is_group_member: { Args: { _group_id: string }; Returns: boolean }
      my_profile_id: { Args: never; Returns: string }
    }
    Enums: {
      approval_status:
        | "pending"
        | "approved"
        | "approved_with_condition"
        | "declined"
        | "expired"
      group_kind: "permanent" | "temporary"
      member_role: "owner" | "admin" | "member"
      plan_status:
        | "draft"
        | "collecting"
        | "recommending"
        | "voting"
        | "finalized"
        | "cancelled"
        | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: [
        "pending",
        "approved",
        "approved_with_condition",
        "declined",
        "expired",
      ],
      group_kind: ["permanent", "temporary"],
      member_role: ["owner", "admin", "member"],
      plan_status: [
        "draft",
        "collecting",
        "recommending",
        "voting",
        "finalized",
        "cancelled",
        "completed",
      ],
    },
  },
} as const
