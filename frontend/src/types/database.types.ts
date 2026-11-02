/**
 * Supabase Database TypeScript Definitions
 * Project ID: wfuhdqldeetizzsvvyyo
 * URL: https://wfuhdqldeetizzsvvyyo.supabase.co
 *
 * To regenerate these types automatically with Supabase CLI:
 *   npx supabase login
 *   npx supabase gen types typescript --project-id wfuhdqldeetizzsvvyyo > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          gemini_api_key_configured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          gemini_api_key_configured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          gemini_api_key_configured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          source_type: 'folder' | 'git' | 'zip';
          source_url: string | null;
          loc: number;
          files_count: number;
          data_files_count: number;
          languages: Json;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          source_type?: 'folder' | 'git' | 'zip';
          source_url?: string | null;
          loc?: number;
          files_count?: number;
          data_files_count?: number;
          languages?: Json;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          source_type?: 'folder' | 'git' | 'zip';
          source_url?: string | null;
          loc?: number;
          files_count?: number;
          data_files_count?: number;
          languages?: Json;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      project_scans: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          summary: string | null;
          architecture_layers: Json;
          diagrams: Json;
          high_coupling_modules: Json;
          circular_dependencies: Json;
          ast_file_manifest: Json;
          scan_duration_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          summary?: string | null;
          architecture_layers?: Json;
          diagrams?: Json;
          high_coupling_modules?: Json;
          circular_dependencies?: Json;
          ast_file_manifest?: Json;
          scan_duration_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          summary?: string | null;
          architecture_layers?: Json;
          diagrams?: Json;
          high_coupling_modules?: Json;
          circular_dependencies?: Json;
          ast_file_manifest?: Json;
          scan_duration_ms?: number | null;
          created_at?: string;
        };
      };
      project_files: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          file_path: string;
          file_name: string;
          extension: string | null;
          file_category: 'code' | 'data' | 'config' | 'document' | 'asset' | 'schema';
          language: string | null;
          size_bytes: number;
          loc: number;
          content: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          file_path: string;
          file_name: string;
          extension?: string | null;
          file_category?: 'code' | 'data' | 'config' | 'document' | 'asset' | 'schema';
          language?: string | null;
          size_bytes?: number;
          loc?: number;
          content?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          file_path?: string;
          file_name?: string;
          extension?: string | null;
          file_category?: 'code' | 'data' | 'config' | 'document' | 'asset' | 'schema';
          language?: string | null;
          size_bytes?: number;
          loc?: number;
          content?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      chat_history: {
        Row: {
          id: string;
          project_id: string | null;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          message: string;
          active_file: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          message: string;
          active_file?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          user_id?: string;
          role?: 'user' | 'assistant' | 'system';
          message?: string;
          active_file?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
  };
}
