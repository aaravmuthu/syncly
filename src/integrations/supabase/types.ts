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
    PostgrestVersion: "14.15"
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
      checkin_requests: {
        Row: {
          created_at: string
          guardian_profile_id: string
          id: string
          lat: number | null
          lon: number | null
          note: string | null
          place_label: string | null
          responded_at: string | null
          status: string
          teen_profile_id: string
        }
        Insert: {
          created_at?: string
          guardian_profile_id: string
          id?: string
          lat?: number | null
          lon?: number | null
          note?: string | null
          place_label?: string | null
          responded_at?: string | null
          status?: string
          teen_profile_id: string
        }
        Update: {
          created_at?: string
          guardian_profile_id?: string
          id?: string
          lat?: number | null
          lon?: number | null
          note?: string | null
          place_label?: string | null
          responded_at?: string | null
          status?: string
          teen_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_requests_guardian_profile_id_fkey"
            columns: ["guardian_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_requests_teen_profile_id_fkey"
            columns: ["teen_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_nicknames: {
        Row: {
          created_at: string
          nickname: string
          owner_profile_id: string
          target_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          nickname: string
          owner_profile_id: string
          target_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          nickname?: string
          owner_profile_id?: string
          target_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_nicknames_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_nicknames_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delay_pings: {
        Row: {
          created_at: string
          id: string
          minutes: number
          new_eta: string | null
          plan_id: string | null
          profile_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          minutes?: number
          new_eta?: string | null
          plan_id?: string | null
          profile_id: string
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          minutes?: number
          new_eta?: string | null
          plan_id?: string | null
          profile_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "delay_pings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_pings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          media_url: string | null
          meta: Json
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          meta?: Json
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          meta?: Json
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_reads: {
        Row: {
          last_read_at: string
          profile_id: string
          thread_id: string
        }
        Insert: {
          last_read_at?: string
          profile_id: string
          thread_id: string
        }
        Update: {
          last_read_at?: string
          profile_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_threads: {
        Row: {
          a_profile_id: string
          b_profile_id: string
          created_at: string
          id: string
          last_message_at: string
        }
        Insert: {
          a_profile_id: string
          b_profile_id: string
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Update: {
          a_profile_id?: string
          b_profile_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_threads_a_profile_id_fkey"
            columns: ["a_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_threads_b_profile_id_fkey"
            columns: ["b_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          profile_id: string
          zone_id: string | null
          zone_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          profile_id: string
          zone_id?: string | null
          zone_label: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          profile_id?: string
          zone_id?: string | null
          zone_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "safe_zones"
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
      group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          media_url: string | null
          meta: Json
          plan_id: string | null
          reply_to_id: string | null
          sender_id: string | null
          system_type: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          group_id: string
          id?: string
          media_url?: string | null
          meta?: Json
          plan_id?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          system_type?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          media_url?: string | null
          meta?: Json
          plan_id?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          system_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey"
            columns: ["sender_id"]
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
          avatar_url: string | null
          cover_theme: string
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
          avatar_url?: string | null
          cover_theme?: string
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
          avatar_url?: string | null
          cover_theme?: string
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
      guardian_alerts: {
        Row: {
          body: string | null
          created_at: string
          guardian_profile_id: string
          id: string
          plan_id: string | null
          priority: string
          read: boolean
          teen_profile_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          guardian_profile_id: string
          id?: string
          plan_id?: string | null
          priority?: string
          read?: boolean
          teen_profile_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          guardian_profile_id?: string
          id?: string
          plan_id?: string | null
          priority?: string
          read?: boolean
          teen_profile_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_alerts_guardian_profile_id_fkey"
            columns: ["guardian_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_alerts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_alerts_teen_profile_id_fkey"
            columns: ["teen_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_links: {
        Row: {
          created_at: string
          guardian_profile_id: string
          id: string
          relation: string
          teen_profile_id: string
        }
        Insert: {
          created_at?: string
          guardian_profile_id: string
          id?: string
          relation?: string
          teen_profile_id: string
        }
        Update: {
          created_at?: string
          guardian_profile_id?: string
          id?: string
          relation?: string
          teen_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_links_guardian_profile_id_fkey"
            columns: ["guardian_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_links_teen_profile_id_fkey"
            columns: ["teen_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_pings: {
        Row: {
          accuracy_m: number | null
          battery_pct: number | null
          created_at: string
          id: string
          lat: number
          lon: number
          plan_id: string | null
          profile_id: string
          status_label: string | null
        }
        Insert: {
          accuracy_m?: number | null
          battery_pct?: number | null
          created_at?: string
          id?: string
          lat: number
          lon: number
          plan_id?: string | null
          profile_id: string
          status_label?: string | null
        }
        Update: {
          accuracy_m?: number | null
          battery_pct?: number | null
          created_at?: string
          id?: string
          lat?: number
          lon?: number
          plan_id?: string | null
          profile_id?: string
          status_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_pings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_pings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          hidden: boolean
          id: string
          mode: string
          owner_profile_id: string
          updated_at: string
          viewer_profile_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          hidden?: boolean
          id?: string
          mode: string
          owner_profile_id: string
          updated_at?: string
          viewer_profile_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          hidden?: boolean
          id?: string
          mode?: string
          owner_profile_id?: string
          updated_at?: string
          viewer_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_shares_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_shares_viewer_profile_id_fkey"
            columns: ["viewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          message_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          message_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          message_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_profile_id_fkey"
            columns: ["profile_id"]
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
      plan_conflicts: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          plan_id: string
          profile_id: string | null
          resolved: boolean
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          plan_id: string
          profile_id?: string | null
          resolved?: boolean
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          plan_id?: string
          profile_id?: string | null
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plan_conflicts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_conflicts_profile_id_fkey"
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
          adult_supervised: boolean
          category: string
          compatibility_score: number | null
          created_at: string
          created_by: string
          est_cost_max: number | null
          est_cost_min: number | null
          food_vibe: string | null
          group_id: string
          id: string
          location_area: string | null
          notes: string | null
          search_radius_miles: number | null
          selected_recommendation_id: string | null
          status: Database["public"]["Enums"]["plan_status"]
          supervision_note: string | null
          title: string
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          adult_supervised?: boolean
          category: string
          compatibility_score?: number | null
          created_at?: string
          created_by: string
          est_cost_max?: number | null
          est_cost_min?: number | null
          food_vibe?: string | null
          group_id: string
          id?: string
          location_area?: string | null
          notes?: string | null
          search_radius_miles?: number | null
          selected_recommendation_id?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          supervision_note?: string | null
          title: string
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          adult_supervised?: boolean
          category?: string
          compatibility_score?: number | null
          created_at?: string
          created_by?: string
          est_cost_max?: number | null
          est_cost_min?: number | null
          food_vibe?: string | null
          group_id?: string
          id?: string
          location_area?: string | null
          notes?: string | null
          search_radius_miles?: number | null
          selected_recommendation_id?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          supervision_note?: string | null
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
          account_type: string
          age: number | null
          avatar_emoji: string
          avatar_url: string | null
          bio: string | null
          budget_preference: string | null
          created_at: string
          curfew_time: string | null
          display_name: string
          grad_year: number | null
          home_address: string | null
          home_area: string | null
          home_lat: number | null
          home_lon: number | null
          id: string
          independence_level: string | null
          is_demo: boolean
          location_pause_indefinite: boolean
          location_paused_until: string | null
          location_sharing_enabled: boolean
          needs_transportation: boolean
          notifications_enabled: boolean
          onboarded: boolean
          parent_approval_required: boolean
          parent_features_enabled: boolean
          personalization_enabled: boolean
          phone: string | null
          preferred_categories: string[]
          school: string | null
          share_contact_with_parents: boolean
          sync_code: string | null
          theme_preference: string
          transport_features_enabled: boolean
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          account_type?: string
          age?: number | null
          avatar_emoji?: string
          avatar_url?: string | null
          bio?: string | null
          budget_preference?: string | null
          created_at?: string
          curfew_time?: string | null
          display_name?: string
          grad_year?: number | null
          home_address?: string | null
          home_area?: string | null
          home_lat?: number | null
          home_lon?: number | null
          id?: string
          independence_level?: string | null
          is_demo?: boolean
          location_pause_indefinite?: boolean
          location_paused_until?: string | null
          location_sharing_enabled?: boolean
          needs_transportation?: boolean
          notifications_enabled?: boolean
          onboarded?: boolean
          parent_approval_required?: boolean
          parent_features_enabled?: boolean
          personalization_enabled?: boolean
          phone?: string | null
          preferred_categories?: string[]
          school?: string | null
          share_contact_with_parents?: boolean
          sync_code?: string | null
          theme_preference?: string
          transport_features_enabled?: boolean
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          account_type?: string
          age?: number | null
          avatar_emoji?: string
          avatar_url?: string | null
          bio?: string | null
          budget_preference?: string | null
          created_at?: string
          curfew_time?: string | null
          display_name?: string
          grad_year?: number | null
          home_address?: string | null
          home_area?: string | null
          home_lat?: number | null
          home_lon?: number | null
          id?: string
          independence_level?: string | null
          is_demo?: boolean
          location_pause_indefinite?: boolean
          location_paused_until?: string | null
          location_sharing_enabled?: boolean
          needs_transportation?: boolean
          notifications_enabled?: boolean
          onboarded?: boolean
          parent_approval_required?: boolean
          parent_features_enabled?: boolean
          personalization_enabled?: boolean
          phone?: string | null
          preferred_categories?: string[]
          school?: string | null
          share_contact_with_parents?: boolean
          sync_code?: string | null
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
          address: string | null
          breakdown: Json
          category: string | null
          cost_max: number | null
          cost_min: number | null
          created_at: string
          feasible: boolean
          id: string
          lat: number | null
          location_name: string | null
          lon: number | null
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
          address?: string | null
          breakdown?: Json
          category?: string | null
          cost_max?: number | null
          cost_min?: number | null
          created_at?: string
          feasible?: boolean
          id?: string
          lat?: number | null
          location_name?: string | null
          lon?: number | null
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
          address?: string | null
          breakdown?: Json
          category?: string | null
          cost_max?: number | null
          cost_min?: number | null
          created_at?: string
          feasible?: boolean
          id?: string
          lat?: number | null
          location_name?: string | null
          lon?: number | null
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
      safe_zones: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string
          lat: number
          lon: number
          radius_m: number
          teen_profile_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label: string
          lat: number
          lon: number
          radius_m?: number
          teen_profile_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label?: string
          lat?: number
          lon?: number
          radius_m?: number
          teen_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safe_zones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safe_zones_teen_profile_id_fkey"
            columns: ["teen_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_assignments: {
        Row: {
          car_label: string
          created_at: string
          departed_at: string | null
          driver_label: string | null
          driver_profile_id: string | null
          eta_minutes: number | null
          id: string
          leg: string
          passenger_profile_ids: string[]
          plan_id: string
          vehicle_color: string | null
          vehicle_desc: string | null
          vehicle_plate: string | null
        }
        Insert: {
          car_label: string
          created_at?: string
          departed_at?: string | null
          driver_label?: string | null
          driver_profile_id?: string | null
          eta_minutes?: number | null
          id?: string
          leg?: string
          passenger_profile_ids?: string[]
          plan_id: string
          vehicle_color?: string | null
          vehicle_desc?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          car_label?: string
          created_at?: string
          departed_at?: string | null
          driver_label?: string | null
          driver_profile_id?: string | null
          eta_minutes?: number | null
          id?: string
          leg?: string
          passenger_profile_ids?: string[]
          plan_id?: string
          vehicle_color?: string | null
          vehicle_desc?: string | null
          vehicle_plate?: string | null
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
      gen_sync_code: { Args: never; Returns: string }
      is_group_admin: { Args: { _group_id: string }; Returns: boolean }
      is_group_member: { Args: { _group_id: string }; Returns: boolean }
      is_group_owner: { Args: { _group_id: string }; Returns: boolean }
      is_my_guardian: { Args: { _guardian: string }; Returns: boolean }
      is_my_teen: { Args: { _teen: string }; Returns: boolean }
      is_plan_owner: { Args: { _plan_id: string }; Returns: boolean }
      is_thread_member: { Args: { _thread_id: string }; Returns: boolean }
      my_profile_id: { Args: never; Returns: string }
      shares_group_with_me: { Args: { _profile_id: string }; Returns: boolean }
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
