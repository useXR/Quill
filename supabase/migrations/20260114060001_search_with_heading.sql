-- Update search_vault_chunks to include heading_context in results
-- Must DROP first because return type is changing (adding heading_context column)

DROP FUNCTION IF EXISTS search_vault_chunks(vector, float, int, uuid, uuid);

CREATE FUNCTION search_vault_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  content text,
  similarity float,
  vault_item_id uuid,
  filename text,
  chunk_index int,
  heading_context text
)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    vc.content,
    (1 - (vc.embedding <=> query_embedding))::float AS similarity,
    vc.vault_item_id,
    vi.filename,
    vc.chunk_index,
    vc.heading_context
  FROM vault_chunks vc
  JOIN vault_items vi ON vc.vault_item_id = vi.id
  WHERE vi.project_id = p_project_id
    AND vi.user_id = p_user_id
    AND (1 - (vc.embedding <=> query_embedding)) > match_threshold
  ORDER BY vc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant execute permission after creating function
GRANT EXECUTE ON FUNCTION search_vault_chunks(vector, float, int, uuid, uuid) TO authenticated;

-- Also update keyword search to include heading_context
-- Must DROP first because return type is changing

DROP FUNCTION IF EXISTS search_vault_chunks_keyword(text, int, uuid, uuid);

CREATE FUNCTION search_vault_chunks_keyword(
  search_query text,
  match_count int,
  p_project_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  content text,
  vault_item_id uuid,
  filename text,
  chunk_index int,
  match_rank int,
  heading_context text
)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    vc.content,
    vc.vault_item_id,
    vi.filename,
    vc.chunk_index,
    (length(vc.content) - length(replace(lower(vc.content), lower(search_query), '')))
      / greatest(length(search_query), 1) AS match_rank,
    vc.heading_context
  FROM vault_chunks vc
  JOIN vault_items vi ON vc.vault_item_id = vi.id
  WHERE vi.project_id = p_project_id
    AND vi.user_id = p_user_id
    AND vc.content ILIKE '%' || search_query || '%'
  ORDER BY match_rank DESC, vc.chunk_index ASC
  LIMIT match_count;
$$;

-- Grant execute permission after creating function
GRANT EXECUTE ON FUNCTION search_vault_chunks_keyword(text, int, uuid, uuid) TO authenticated;
