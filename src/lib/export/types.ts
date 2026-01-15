import type { Database } from '@/lib/supabase/database.types';

export type Document = Database['public']['Tables']['documents']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];

export interface DocumentWithProject extends Document {
  projects: Pick<Project, 'user_id'>;
}

export interface DocxExportOptions {
  title: string;
  author?: string;
  includeTitle?: boolean;
  pageSize?: 'letter' | 'a4';
}

export interface PdfExportOptions {
  title: string;
  format?: 'letter' | 'a4';
  includePageNumbers?: boolean;
}
