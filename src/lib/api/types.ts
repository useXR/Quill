export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code: string; details?: unknown };

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  totalCount?: number;
}
