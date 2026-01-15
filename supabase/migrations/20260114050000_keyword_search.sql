-- Add keyword search function for exact phrase matching
-- This complements the semantic search with text-based search

-- Create a function for keyword/text search using ILIKE pattern matching
-- This is more reliable for exact phrase searches than full-text search
create or replace function search_vault_chunks_keyword(
  search_query text,
  match_count int,
  p_project_id uuid,
  p_user_id uuid
)
returns table (
  content text,
  vault_item_id uuid,
  filename text,
  chunk_index int,
  match_rank int
)
language sql stable
security definer
as $$
  select
    vc.content,
    vc.vault_item_id,
    vi.filename,
    vc.chunk_index,
    -- Rank by number of occurrences (case-insensitive)
    (length(vc.content) - length(replace(lower(vc.content), lower(search_query), '')))
      / greatest(length(search_query), 1) as match_rank
  from vault_chunks vc
  join vault_items vi on vc.vault_item_id = vi.id
  where vi.project_id = p_project_id
    and vi.user_id = p_user_id
    and vc.content ilike '%' || search_query || '%'
  order by match_rank desc, vc.chunk_index asc
  limit match_count;
$$;

-- Grant execute permission to authenticated users
grant execute on function search_vault_chunks_keyword(text, int, uuid, uuid) to authenticated;
