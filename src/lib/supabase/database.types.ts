export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      ai_operations: {
        Row: {
          created_at: string
          document_id: string
          id: string
          input_summary: string | null
          operation_type: string
          output_content: string | null
          snapshot_before: Json | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          input_summary?: string | null
          operation_type: string
          output_content?: string | null
          snapshot_before?: Json | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          input_summary?: string | null
          operation_type?: string
          output_content?: string | null
          snapshot_before?: Json | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_operations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_operations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: unknown
          success: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
        }
        Relationships: []
      }
      chat_history: {
        Row: {
          content: string
          created_at: string
          document_id: string | null
          id: string
          project_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          document_id?: string | null
          id?: string
          project_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string | null
          id?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_history_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      citations: {
        Row: {
          abstract: string | null
          authors: string | null
          citation_count: number | null
          created_at: string
          deleted_at: string | null
          doi: string | null
          external_ids: Json | null
          id: string
          journal: string | null
          notes: string | null
          pages: string | null
          paper_id: string | null
          project_id: string
          publication_date: string | null
          source: string | null
          title: string
          url: string | null
          venue: string | null
          verified: boolean | null
          volume: string | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: string | null
          citation_count?: number | null
          created_at?: string
          deleted_at?: string | null
          doi?: string | null
          external_ids?: Json | null
          id?: string
          journal?: string | null
          notes?: string | null
          pages?: string | null
          paper_id?: string | null
          project_id: string
          publication_date?: string | null
          source?: string | null
          title: string
          url?: string | null
          venue?: string | null
          verified?: boolean | null
          volume?: string | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: string | null
          citation_count?: number | null
          created_at?: string
          deleted_at?: string | null
          doi?: string | null
          external_ids?: Json | null
          id?: string
          journal?: string | null
          notes?: string | null
          pages?: string | null
          paper_id?: string | null
          project_id?: string
          publication_date?: string | null
          source?: string | null
          title?: string
          url?: string | null
          venue?: string | null
          verified?: boolean | null
          volume?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "citations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_citations: {
        Row: {
          citation_id: string
          citation_number: number | null
          created_at: string
          document_id: string
          id: string
          position: Json | null
        }
        Insert: {
          citation_id: string
          citation_number?: number | null
          created_at?: string
          document_id: string
          id?: string
          position?: Json | null
        }
        Update: {
          citation_id?: string
          citation_number?: number | null
          created_at?: string
          document_id?: string
          id?: string
          position?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_citations_citation_id_fkey"
            columns: ["citation_id"]
            isOneToOne: false
            referencedRelation: "citations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_citations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: Json | null
          content_text: string | null
          created_at: string
          id: string
          project_id: string
          sort_order: number | null
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          content?: Json | null
          content_text?: string | null
          created_at?: string
          id?: string
          project_id: string
          sort_order?: number | null
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          content?: Json | null
          content_text?: string | null
          created_at?: string
          id?: string
          project_id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          heading_context: string | null
          id: string
          vault_item_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          heading_context?: string | null
          id?: string
          vault_item_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          heading_context?: string | null
          id?: string
          vault_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_chunks_vault_item_id_fkey"
            columns: ["vault_item_id"]
            isOneToOne: false
            referencedRelation: "vault_items"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_items: {
        Row: {
          chunk_count: number | null
          created_at: string
          deleted_at: string | null
          extracted_text: string | null
          extraction_status: string | null
          file_size: number | null
          filename: string | null
          id: string
          mime_type: string | null
          project_id: string | null
          source_url: string | null
          storage_path: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string
          deleted_at?: string | null
          extracted_text?: string | null
          extraction_status?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          project_id?: string | null
          source_url?: string | null
          storage_path?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chunk_count?: number | null
          created_at?: string
          deleted_at?: string | null
          extracted_text?: string | null
          extraction_status?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          project_id?: string | null
          source_url?: string | null
          storage_path?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_items_user_id_fkey"
            columns: ["user_id"]
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
      check_auth_rate_limit: {
        Args: {
          max_attempts?: number
          p_email: string
          p_ip: unknown
          window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_citations: {
        Args: { grace_period_days?: number }
        Returns: number
      }
      cleanup_old_records: { Args: never; Returns: undefined }
      cleanup_soft_deleted_vault_items: { Args: never; Returns: number }
      get_next_citation_number: {
        Args: { p_document_id: string }
        Returns: number
      }
      search_vault_chunks:
        | {
            Args: {
              match_count: number
              match_threshold: number
              p_project_id: string
              query_embedding: string
            }
            Returns: {
              content: string
              filename: string
              similarity: number
              vault_item_id: string
            }[]
          }
        | {
            Args: {
              match_count: number
              match_threshold: number
              p_project_id: string
              p_user_id: string
              query_embedding: string
            }
            Returns: {
              chunk_index: number
              content: string
              filename: string
              heading_context: string
              similarity: number
              vault_item_id: string
            }[]
          }
      search_vault_chunks_keyword: {
        Args: {
          match_count: number
          p_project_id: string
          p_user_id: string
          search_query: string
        }
        Returns: {
          chunk_index: number
          content: string
          filename: string
          heading_context: string
          match_rank: number
          vault_item_id: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

