-- Update search_vault_chunks function with explicit user_id parameter and chunk_index
-- This migration enhances the existing search function from initial_schema.sql

create or replace function search_vault_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid,
  p_user_id uuid
)
returns table (
  content text,
  similarity float,
  vault_item_id uuid,
  filename text,
  chunk_index int
)
language sql stable
security definer
as $$
  select
    vc.content,
    (1 - (vc.embedding <=> query_embedding))::float as similarity,
    vc.vault_item_id,
    vi.filename,
    vc.chunk_index
  from vault_chunks vc
  join vault_items vi on vc.vault_item_id = vi.id
  where vi.project_id = p_project_id
    and vi.user_id = p_user_id
    and (1 - (vc.embedding <=> query_embedding)) > match_threshold
  order by vc.embedding <=> query_embedding
  limit match_count;
$$;
