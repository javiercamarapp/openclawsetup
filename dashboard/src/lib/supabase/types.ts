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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      direct_messages: {
        Row: {
          id: string
          thread_id: string
          sender: string
          content: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          sender: string
          content: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          sender?: string
          content?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      task_schedules: {
        Row: {
          id: string
          task_id: string
          cron_expression: string | null
          next_run_at: string | null
          last_run_at: string | null
          enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          cron_expression?: string | null
          next_run_at?: string | null
          last_run_at?: string | null
          enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          cron_expression?: string | null
          next_run_at?: string | null
          last_run_at?: string | null
          enabled?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_schedules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_positions: {
        Row: {
          code: string
          division: number | null
          last_seen_at: string
          world_state: string
          world_target_x: number
          world_target_y: number
          world_x: number
          world_y: number
        }
        Insert: {
          code: string
          division?: number | null
          last_seen_at?: string
          world_state?: string
          world_target_x?: number
          world_target_y?: number
          world_x?: number
          world_y?: number
        }
        Update: {
          code?: string
          division?: number | null
          last_seen_at?: string
          world_state?: string
          world_target_x?: number
          world_target_y?: number
          world_x?: number
          world_y?: number
        }
        Relationships: []
      }
      conv_log: {
        Row: {
          agent_a_code: string | null
          agent_b_code: string | null
          ended_at: string | null
          id: string
          openclaw_session_id: string | null
          started_at: string
          status: string
          summary: string | null
          total_cost: number
          total_tokens: number
          trigger_context: string | null
          trigger_type: string | null
        }
        Insert: {
          agent_a_code?: string | null
          agent_b_code?: string | null
          ended_at?: string | null
          id?: string
          openclaw_session_id?: string | null
          started_at?: string
          status?: string
          summary?: string | null
          total_cost?: number
          total_tokens?: number
          trigger_context?: string | null
          trigger_type?: string | null
        }
        Update: {
          agent_a_code?: string | null
          agent_b_code?: string | null
          ended_at?: string | null
          id?: string
          openclaw_session_id?: string | null
          started_at?: string
          status?: string
          summary?: string | null
          total_cost?: number
          total_tokens?: number
          trigger_context?: string | null
          trigger_type?: string | null
        }
        Relationships: []
      }
      costs_log: {
        Row: {
          agent_code: string
          cost: number
          date: string
          error_count: number
          id: string
          model: string
          request_count: number
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          agent_code: string
          cost?: number
          date: string
          error_count?: number
          id?: string
          model: string
          request_count?: number
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          agent_code?: string
          cost?: number
          date?: string
          error_count?: number
          id?: string
          model?: string
          request_count?: number
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: []
      }
      msg_log: {
        Row: {
          content: string
          conv_id: string
          cost: number
          created_at: string
          id: string
          latency_ms: number | null
          model_used: string | null
          role: string
          speaker: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          content: string
          conv_id: string
          cost?: number
          created_at?: string
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          role: string
          speaker: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          content?: string
          conv_id?: string
          cost?: number
          created_at?: string
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          role?: string
          speaker?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "msg_log_conv_id_fkey"
            columns: ["conv_id"]
            isOneToOne: false
            referencedRelation: "conv_log"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to_code: string | null
          assigned_to_javier: boolean
          completed_at: string | null
          conv_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          priority: string
          scheduled_at: string | null
          recurrence: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          assigned_to_code?: string | null
          assigned_to_javier?: boolean
          completed_at?: string | null
          conv_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          priority: string
          scheduled_at?: string | null
          recurrence?: string | null
          status?: string
          title: string
          type: string
        }
        Update: {
          assigned_to_code?: string | null
          assigned_to_javier?: boolean
          completed_at?: string | null
          conv_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          scheduled_at?: string | null
          recurrence?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_conv_id_fkey"
            columns: ["conv_id"]
            isOneToOne: false
            referencedRelation: "conv_log"
            referencedColumns: ["id"]
          },
        ]
      }
      world_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
