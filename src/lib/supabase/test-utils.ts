import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';
import type { ProjectInsert, DocumentInsert } from './types';

// Type for valid table names in the public schema
type TableName = keyof Database['public']['Tables'];

/**
 * WARNING: Service role key bypasses RLS
 * Only use in test environment with test data
 */
export function createTestClient() {
  // Safety check: only allow in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'createTestClient should only be used in test environment. ' + `Current NODE_ENV: ${process.env.NODE_ENV}`
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a test user and returns the user object
 */
export async function createTestUser(email: string, password: string) {
  const client = createTestClient();

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw error;
  return data.user;
}

/**
 * Deletes a test user by ID
 */
export async function deleteTestUser(userId: string) {
  const client = createTestClient();
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/**
 * Cleans up all test data for a user
 */
export async function cleanupTestData(userId: string) {
  const client = createTestClient();

  // Delete in order respecting foreign keys
  // Projects cascade to documents, vault_items, etc.
  await client.from('audit_logs').delete().eq('user_id', userId);
  await client.from('projects').delete().eq('user_id', userId);
  await client.from('profiles').delete().eq('id', userId);
}

/**
 * Creates an audit log entry (for testing audit functionality)
 */
export async function createAuditLog(
  userId: string,
  action: string,
  resource: { type: string; id?: string },
  changes?: Json
) {
  const client = createTestClient();

  const { error } = await client.from('audit_logs').insert({
    user_id: userId,
    action,
    resource_type: resource.type,
    resource_id: resource.id,
    changes,
  });

  if (error) throw error;
}

/**
 * TestData class with auto-cleanup for test isolation.
 * Tracks created records and deletes them in reverse order.
 */
export class TestData {
  private createdRecords: { table: TableName; id: string }[] = [];
  private client = createTestClient();

  /**
   * Create a project and track it for cleanup.
   */
  async createProject(userId: string, data: Partial<ProjectInsert> = {}) {
    const { data: project, error } = await this.client
      .from('projects')
      .insert({
        user_id: userId,
        title: `Test Project ${Date.now()}`,
        status: 'draft',
        ...data,
      })
      .select()
      .single();

    if (error) throw error;
    this.createdRecords.push({ table: 'projects', id: project.id });
    return project;
  }

  /**
   * Create a document and track it for cleanup.
   */
  async createDocument(projectId: string, data: Partial<DocumentInsert> = {}) {
    const { data: document, error } = await this.client
      .from('documents')
      .insert({
        project_id: projectId,
        title: `Test Document ${Date.now()}`,
        content: {},
        content_text: '',
        sort_order: 0,
        version: 1,
        ...data,
      })
      .select()
      .single();

    if (error) throw error;
    this.createdRecords.push({ table: 'documents', id: document.id });
    return document;
  }

  /**
   * Track an externally created record for cleanup.
   */
  track(table: TableName, id: string) {
    this.createdRecords.push({ table, id });
  }

  /**
   * Clean up all tracked records in reverse order.
   * Call this in afterEach or afterAll.
   */
  async cleanup() {
    // NOTE: Using spread to avoid mutating the original array
    const toDelete = [...this.createdRecords].reverse();
    for (const { table, id } of toDelete) {
      try {
        await this.client.from(table).delete().eq('id', id);
      } catch (error) {
        console.warn(`Failed to cleanup ${table}:${id}`, error);
      }
    }
    this.createdRecords = [];
  }

  /**
   * Get count of tracked records.
   */
  get count() {
    return this.createdRecords.length;
  }
}
