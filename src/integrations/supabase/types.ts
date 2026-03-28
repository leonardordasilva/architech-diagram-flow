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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_requests: {
        Row: {
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      diagram_shares: {
        Row: {
          created_at: string
          diagram_id: string
          id: string
          owner_id: string
          shared_with_id: string
        }
        Insert: {
          created_at?: string
          diagram_id: string
          id?: string
          owner_id: string
          shared_with_id: string
        }
        Update: {
          created_at?: string
          diagram_id?: string
          id?: string
          owner_id?: string
          shared_with_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagram_shares_diagram_id_fkey"
            columns: ["diagram_id"]
            isOneToOne: false
            referencedRelation: "diagrams"
            referencedColumns: ["id"]
          },
        ]
      }
      diagrams: {
        Row: {
          created_at: string
          deleted_at: string | null
          edge_count: number
          edges: Json
          id: string
          is_shared: boolean
          node_count: number
          nodes: Json
          owner_id: string
          share_token: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          edge_count?: number
          edges?: Json
          id?: string
          is_shared?: boolean
          node_count?: number
          nodes?: Json
          owner_id: string
          share_token?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          edge_count?: number
          edges?: Json
          id?: string
          is_shared?: boolean
          node_count?: number
          nodes?: Json
          owner_id?: string
          share_token?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          plan: string
          max_diagrams: number | null
          max_nodes_per_diagram: number | null
          max_collaborators_per_diagram: number | null
          allowed_export_formats: string[]
          watermark_enabled: boolean
          realtime_collab_enabled: boolean
          email_sharing_enabled: boolean
        }
        Insert: {
          plan: string
          max_diagrams?: number | null
          max_nodes_per_diagram?: number | null
          max_collaborators_per_diagram?: number | null
          allowed_export_formats?: string[]
          watermark_enabled?: boolean
          realtime_collab_enabled?: boolean
          email_sharing_enabled?: boolean
        }
        Update: {
          plan?: string
          max_diagrams?: number | null
          max_nodes_per_diagram?: number | null
          max_collaborators_per_diagram?: number | null
          allowed_export_formats?: string[]
          watermark_enabled?: boolean
          realtime_collab_enabled?: boolean
          email_sharing_enabled?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          plan: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          plan?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          plan?: string
        }
        Relationships: []
      }
      workspace_invites: {
        Row: {
          id: string
          workspace_id: string
          email: string
          role: string
          invited_by: string
          token: string
          created_at: string
          expires_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          role: string
          invited_by: string
          token: string
          created_at?: string
          expires_at: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          role?: string
          invited_by?: string
          token?: string
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: string
          invited_by: string | null
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role: string
          invited_by?: string | null
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: string
          invited_by?: string | null
          invited_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          name: string
          owner_id: string
          plan: string
          stripe_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          plan?: string
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: string
          status: string
          billing_cycle: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan?: string
          status?: string
          billing_cycle?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan?: string
          status?: string
          billing_cycle?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_diagram_by_share_token: {
        Args: { token: string }
        Returns: {
          created_at: string
          edge_count: number
          edges: Json
          id: string
          is_shared: boolean
          node_count: number
          nodes: Json
          owner_id: string
          share_token: string | null
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "diagrams"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_diagram_owner: { Args: { diagram_id: string }; Returns: string }
      get_diagram_title: { Args: { diagram_id: string }; Returns: string }
      get_user_plan_limits: {
        Args: { p_user_id: string }
        Returns: {
          plan: string
          max_diagrams: number | null
          max_nodes_per_diagram: number | null
          max_collaborators_per_diagram: number | null
          allowed_export_formats: string[]
          watermark_enabled: boolean
          realtime_collab_enabled: boolean
          email_sharing_enabled: boolean
        }[]
      }
      get_user_diagram_count: { Args: { p_user_id: string }; Returns: number }
      is_diagram_collaborator: { Args: { p_diagram_id: string; p_user_id: string }; Returns: boolean }
      search_users_by_email: {
        Args: { p_query: string; p_exclude_user_id: string }
        Returns: { id: string; email: string }[]
      }
      get_user_workspace: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          name: string
          owner_id: string
          stripe_subscription_id: string | null
          created_at: string
          role: string
        }[]
      }
      get_workspace_editor_count: { Args: { p_workspace_id: string }; Returns: number }
      get_workspace_members: {
        Args: { p_workspace_id: string }
        Returns: {
          id: string
          user_id: string
          email: string
          role: string
          invited_at: string
          accepted_at: string | null
        }[]
      }
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
  public: {
    Enums: {},
  },
} as const
