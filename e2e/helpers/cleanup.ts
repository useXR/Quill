/**
 * Cleanup utilities for test data management.
 * Ensures test isolation by cleaning up created data.
 *
 * NOTE: This file uses a generic client type to avoid importing from
 * @/lib/supabase/database.types which is generated in Task 0.7.
 * The client parameter accepts any Supabase client instance.
 */

// Generic interface that matches Supabase client's query methods
interface SupabaseQueryClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: string): Promise<{ error: Error | null }>;
      like(column: string, pattern: string): Promise<{ error: Error | null }>;
    };
  };
}

/**
 * Cleanup class that tracks created records and deletes them in reverse order.
 * Use this to ensure test data is cleaned up after each test.
 */
export class TestDataCleanup {
  private createdRecords: { table: string; id: string }[] = [];

  constructor(private supabase: SupabaseQueryClient) {}

  /**
   * Track a record for cleanup.
   * Records are deleted in reverse order to respect foreign key constraints.
   */
  track(table: string, id: string) {
    this.createdRecords.push({ table, id });
  }

  /**
   * Clean up all tracked records.
   * Call this in afterEach or test cleanup fixture.
   */
  async cleanup() {
    // Delete in reverse order to respect foreign keys
    // NOTE: Using spread to avoid mutating the original array
    const toDelete = [...this.createdRecords].reverse();
    for (const { table, id } of toDelete) {
      try {
        await this.supabase.from(table).delete().eq('id', id);
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

/**
 * Clean up test data by prefix pattern.
 * Useful for cleaning up worker-specific test data.
 */
export async function cleanupByPrefix(supabase: SupabaseQueryClient, table: string, column: string, prefix: string) {
  await supabase.from(table).delete().like(column, `${prefix}%`);
}
