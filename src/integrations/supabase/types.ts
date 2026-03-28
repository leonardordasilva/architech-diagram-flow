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
    PostgrestVersion: "14.4"
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
        Relationships: [
          {
            foreignKeyName: "diagrams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          allowed_export_formats: string[]
          email_sharing_enabled: boolean
          max_collaborators_per_diagram: number | null
          max_diagrams: number | null
          max_nodes_per_diagram: number | null
          plan: string
          realtime_collab_enabled: boolean
          watermark_enabled: boolean
        }
        Insert: {
          allowed_export_formats?: string[]
          email_sharing_enabled?: boolean
          max_collaborators_per_diagram?: number | null
          max_diagrams?: number | null
          max_nodes_per_diagram?: number | null
          plan: string
          realtime_collab_enabled?: boolean
          watermark_enabled?: boolean
        }
        Update: {
          allowed_export_formats?: string[]
          email_sharing_enabled?: boolean
          max_collaborators_per_diagram?: number | null
          max_diagrams?: number | null
          max_nodes_per_diagram?: number | null
          plan?: string
          realtime_collab_enabled?: boolean
          watermark_enabled?: boolean
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
      subscriptions: {
        Row: {
          billing_cycle: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
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
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role: string
          token: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          invited_by: string | null
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
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
      get_my_owner_workspace_ids: { Args: never; Returns: string[] }
      get_my_workspace_ids: { Args: never; Returns: string[] }
      get_user_diagram_count: { Args: { p_user_id: string }; Returns: number }
      get_user_plan_limits: {
        Args: { p_user_id: string }
        Returns: {
          allowed_export_formats: string[]
          email_sharing_enabled: boolean
          max_collaborators_per_diagram: number
          max_diagrams: number
          max_nodes_per_diagram: number
          plan: string
          realtime_collab_enabled: boolean
          watermark_enabled: boolean
        }[]
      }
      get_user_workspace: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          id: string
          name: string
          owner_id: string
          role: string
          stripe_subscription_id: string
        }[]
      }
      get_workspace_editor_count: {
        Args: { p_workspace_id: string }
        Returns: number
      }
      get_workspace_members: {
        Args: { p_workspace_id: string }
        Returns: {
          accepted_at: string
          email: string
          id: string
          invited_at: string
          role: string
          user_id: string
        }[]
      }
      is_diagram_collaborator: {
        Args: { p_diagram_id: string; p_user_id: string }
        Returns: boolean
      }
      purge_old_soft_deleted_diagrams: { Args: never; Returns: number }
      search_users_by_email: {
        Args: { p_exclude_user_id: string; p_query: string }
        Returns: {
          email: string
          id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_diagram: {
        Args: { p_diagram_id: string; p_owner_id: string }
        Returns: undefined
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
