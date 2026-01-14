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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
          created_at: string
          doi: string | null
          id: string
          journal: string | null
          project_id: string
          source: string | null
          title: string
          url: string | null
          verified: boolean | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: string | null
          created_at?: string
          doi?: string | null
          id?: string
          journal?: string | null
          project_id: string
          source?: string | null
          title: string
          url?: string | null
          verified?: boolean | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: string | null
          created_at?: string
          doi?: string | null
          id?: string
          journal?: string | null
          project_id?: string
          source?: string | null
          title?: string
          url?: string | null
          verified?: boolean | null
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
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          embedding: string | null
          id: string
          vault_item_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          embedding?: string | null
          id?: string
          vault_item_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          embedding?: string | null
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
      search_vault_chunks: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          p_project_id: string
        }
        Returns: {
          content: string
          similarity: number
          vault_item_id: string
          filename: string
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

