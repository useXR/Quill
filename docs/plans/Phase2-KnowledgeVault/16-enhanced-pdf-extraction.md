# Task 2.16: Enhanced PDF Extraction with pymupdf4llm

> **Phase 2** | [← Project Sidebar](./15-project-sidebar.md) | [Next: Verification →](./99-verification.md)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace pdf-parse with pymupdf4llm for better academic paper extraction, including section-aware chunking with heading context preservation.

**Architecture:** Python subprocess called from Node.js with pdf-parse fallback. The Python script extracts PDF to structured markdown, returns JSON with sections and headings. TypeScript chunker processes sections independently, preserving heading context in each chunk. Feature flag enables gradual rollout.

**Tech Stack:** pymupdf4llm (Python 3.9+), Node.js child_process, structured JSON IPC, pdf-parse (fallback)

---

## Context

**This task improves PDF text extraction for academic papers.** The current `pdf-parse` library has known issues with missing spaces around styled text (italics, bold) and produces line-by-line output without paragraph awareness. This upgrade uses `pymupdf4llm` which:

- Detects section headings via font size analysis
- Preserves paragraph structure
- Outputs markdown with proper `#` heading tags
- Handles styled text spacing correctly

### Why Python Subprocess?

For bursty workloads (chunking several documents, then none for a while), subprocess is appropriate:

- No persistent server to maintain
- Process starts/stops on demand
- No memory overhead when idle
- Simple deployment (just Python + pip)
- Each invocation is isolated

**Tradeoffs acknowledged:**

- Cold start latency: ~1-2 seconds for first PDF (Python + pymupdf4llm loading)
- Deployment complexity: Requires Python 3.9+ in container
- Alternative considered: `mupdf.js` (WASM) - rejected because pymupdf4llm's markdown/heading extraction is superior

### Prerequisites

- **Task 2.6** completed (current PDF extraction exists)
- **Task 2.7** completed (current chunker exists)
- Python 3.9+ installed on deployment environment

### What This Task Creates

- `scripts/extract_pdf.py` - Python extraction script
- `scripts/requirements.txt` - Python dependencies
- `src/lib/extraction/pdf.ts` - Updated to call Python subprocess with fallback
- `src/lib/extraction/chunker.ts` - Section-aware chunking with `Section` interface
- `src/lib/extraction/index.ts` - Updated exports
- `src/lib/extraction/__tests__/pdf.test.ts` - Replaced with new tests
- `src/lib/extraction/__tests__/chunker.test.ts` - Section-aware tests added
- `src/lib/extraction/__tests__/fixtures/` - Test fixtures directory
- `src/lib/api/search.ts` - Updated to include headingContext in all search modes
- `src/lib/vault/types.ts` - SearchResult with headingContext
- Database migrations for heading context and search function updates

### Tasks That Depend on This

- None (enhancement to existing functionality)

---

## Files to Create/Modify

- `scripts/extract_pdf.py` (create)
- `scripts/requirements.txt` (create)
- `src/lib/extraction/pdf.ts` (replace)
- `src/lib/extraction/chunker.ts` (modify)
- `src/lib/extraction/processor.ts` (modify)
- `src/lib/extraction/index.ts` (modify)
- `src/lib/extraction/__tests__/pdf.test.ts` (replace - not merge)
- `src/lib/extraction/__tests__/chunker.test.ts` (add tests)
- `src/lib/extraction/__tests__/processor.test.ts` (modify - if exists)
- `src/lib/extraction/__tests__/fixtures/.gitkeep` (create)
- `src/lib/api/search.ts` (modify)
- `src/lib/api/__tests__/search.test.ts` (modify - if exists, add headingContext)
- `src/lib/vault/types.ts` (modify)
- `supabase/migrations/20260114060000_chunk_heading_context.sql` (create)
- `supabase/migrations/20260114060001_search_with_heading.sql` (create)

**Note:** Replace the timestamp prefix (e.g., `20260114060000`) with the current date/time when creating migrations.

---

## Steps

### Step 1: Create Python requirements file

Create `scripts/requirements.txt`:

```text
pymupdf4llm==0.0.17
pymupdf==1.24.0
```

**Note:** Versions are pinned exactly because pymupdf4llm is pre-1.0 software where any version bump can have breaking changes.

---

### Step 2: Install Python dependencies

```bash
pip install -r scripts/requirements.txt
```

**Expected:** Packages installed successfully

---

### Step 3: Create Python extraction script

Create `scripts/extract_pdf.py`:

```python
#!/usr/bin/env python3
"""
PDF extraction script using pymupdf4llm.
Outputs structured JSON with sections and markdown content.

Usage: python3 extract_pdf.py <pdf_path>
Output: JSON to stdout with structure:
{
  "success": true,
  "markdown": "# Title\n\nContent...",
  "sections": [
    {"level": 1, "title": "Introduction", "heading_context": "Introduction", "content": "...", "start_line": 0},
    ...
  ],
  "page_count": 10,
  "error": null
}
"""

import sys
import json
import re
import os
import tempfile
from pathlib import Path

# Python version check - must be 3.9+ for type hint syntax
if sys.version_info < (3, 9):
    print(json.dumps({
        "success": False,
        "markdown": "",
        "sections": [],
        "page_count": 0,
        "error": f"Python 3.9+ required, found {sys.version_info.major}.{sys.version_info.minor}"
    }))
    sys.exit(1)

try:
    import pymupdf4llm
    import pymupdf
except ImportError as e:
    print(json.dumps({
        "success": False,
        "markdown": "",
        "sections": [],
        "page_count": 0,
        "error": f"pymupdf4llm not installed: {e}. Run: pip install pymupdf4llm"
    }))
    sys.exit(1)


def log_stderr(level: str, message: str, **kwargs) -> None:
    """Structured log output to stderr for debugging."""
    import time
    print(json.dumps({
        "level": level,
        "message": message,
        "timestamp": time.time(),
        **kwargs
    }), file=sys.stderr)


def validate_path(pdf_path: str) -> tuple[bool, str]:
    """
    Validate the PDF path is safe to process.
    Returns (is_valid, error_message).

    Security: Uses realpath to resolve symlinks and '..' to prevent path traversal.
    """
    # Must be absolute path
    if not os.path.isabs(pdf_path):
        return False, "Path must be absolute"

    # Resolve symlinks and '..' to get canonical path
    temp_dir = tempfile.gettempdir()
    real_path = os.path.realpath(pdf_path)
    real_temp = os.path.realpath(temp_dir)

    # Must be in temp directory (security: prevent arbitrary file access)
    # Use os.sep suffix to prevent /tmp_malicious matching /tmp
    if not real_path.startswith(real_temp + os.sep):
        return False, f"Path must be in temp directory ({temp_dir})"

    # Must exist and be a file
    if not os.path.isfile(real_path):
        return False, "Path is not a file or does not exist"

    return True, ""


def parse_sections(markdown: str) -> list[dict]:
    """
    Parse markdown into sections based on headings.
    Returns list of sections with level, title, content, and position.
    """
    sections = []
    lines = markdown.split('\n')

    current_section = None
    content_lines = []
    heading_stack: list[dict] = []  # Track parent headings for context

    heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$')

    for i, line in enumerate(lines):
        match = heading_pattern.match(line)

        if match:
            # Save previous section if exists
            if current_section is not None:
                current_section['content'] = '\n'.join(content_lines).strip()
                sections.append(current_section)

            level = len(match.group(1))
            title = match.group(2).strip()

            # Truncate very long titles (edge case: misidentified headings)
            if len(title) > 200:
                title = title[:200] + "..."

            # Update heading stack for context
            # Remove headings at same or lower level
            while heading_stack and heading_stack[-1]['level'] >= level:
                heading_stack.pop()

            # Build heading context (e.g., "Methods > Participants")
            heading_context = ' > '.join(h['title'] for h in heading_stack)
            if heading_context:
                heading_context += ' > ' + title
            else:
                heading_context = title

            # Truncate very long heading contexts
            if len(heading_context) > 500:
                heading_context = "..." + heading_context[-497:]

            current_section = {
                'level': level,
                'title': title,
                'heading_context': heading_context,
                'content': '',
                'start_line': i
            }

            heading_stack.append({'level': level, 'title': title})
            content_lines = []
        else:
            content_lines.append(line)

    # Don't forget the last section
    if current_section is not None:
        current_section['content'] = '\n'.join(content_lines).strip()
        sections.append(current_section)
    elif content_lines:
        # Document has no headings - treat entire content as one section
        sections.append({
            'level': 0,
            'title': '',
            'heading_context': '',
            'content': '\n'.join(content_lines).strip(),
            'start_line': 0
        })

    return sections


def extract_pdf(pdf_path: str) -> dict:
    """
    Extract PDF to structured markdown with sections.
    """
    try:
        # Validate path for security
        is_valid, error_msg = validate_path(pdf_path)
        if not is_valid:
            return {
                "success": False,
                "markdown": "",
                "sections": [],
                "page_count": 0,
                "error": f"Invalid path: {error_msg}"
            }

        path = Path(pdf_path)

        log_stderr("info", "Starting PDF extraction", path=str(path))

        # Extract to markdown using pymupdf4llm
        markdown = pymupdf4llm.to_markdown(str(path))

        # Get page count
        doc = pymupdf.open(str(path))
        page_count = len(doc)
        doc.close()

        # Handle image-only PDFs (no extractable text)
        if not markdown or not markdown.strip():
            log_stderr("warn", "No text extracted from PDF (may be image-only)")
            return {
                "success": True,
                "markdown": "",
                "sections": [],
                "page_count": page_count,
                "error": None
            }

        # Parse sections from markdown
        sections = parse_sections(markdown)

        log_stderr("info", "Extraction complete",
                   page_count=page_count,
                   section_count=len(sections),
                   markdown_length=len(markdown))

        return {
            "success": True,
            "markdown": markdown,
            "sections": sections,
            "page_count": page_count,
            "error": None
        }

    except Exception as e:
        log_stderr("error", "Extraction failed", error=str(e))
        return {
            "success": False,
            "markdown": "",
            "sections": [],
            "page_count": 0,
            "error": str(e)
        }


def main():
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "markdown": "",
            "sections": [],
            "page_count": 0,
            "error": "Usage: python3 extract_pdf.py <pdf_path>"
        }))
        sys.exit(1)

    pdf_path = sys.argv[1]
    result = extract_pdf(pdf_path)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
```

---

### Step 4: Make Python script executable

```bash
chmod +x scripts/extract_pdf.py
```

**Expected:** Script is executable

---

### Step 5: Test Python script manually (optional)

To test, you need a PDF file in the temp directory:

```bash
# Copy a test PDF to temp and run extraction
cp /path/to/any/paper.pdf /tmp/test.pdf
python3 scripts/extract_pdf.py /tmp/test.pdf
```

**Expected output structure:**

```json
{
  "success": true,
  "markdown": "# Section Title\n\nContent...",
  "sections": [
    {
      "level": 1,
      "title": "Section Title",
      "heading_context": "Section Title",
      "content": "Content...",
      "start_line": 0
    }
  ],
  "page_count": 1,
  "error": null
}
```

**Note:** The script requires the PDF to be in the system temp directory for security.

**macOS Note:** Node.js `os.tmpdir()` may return `/var/folders/...` while Python's `tempfile.gettempdir()` returns `/tmp`. These typically resolve to the same location, but verify in your environment if extraction fails with path errors.

---

### Step 6: Create database migration for heading context

Create `supabase/migrations/20260114060000_chunk_heading_context.sql`:

```sql
-- Add heading_context column to vault_chunks for section awareness
-- This stores the hierarchical heading path (e.g., "Methods > Participants")

ALTER TABLE vault_chunks
ADD COLUMN IF NOT EXISTS heading_context text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN vault_chunks.heading_context IS
  'Hierarchical heading path for this chunk (e.g., "Introduction" or "Methods > Participants")';

-- Create index for prefix searches on heading context
CREATE INDEX IF NOT EXISTS idx_vault_chunks_heading_context
ON vault_chunks (heading_context text_pattern_ops)
WHERE heading_context IS NOT NULL;
```

---

### Step 7: Create database migration to update search functions

Create `supabase/migrations/20260114060001_search_with_heading.sql`:

**IMPORTANT:** PostgreSQL cannot use `CREATE OR REPLACE FUNCTION` to change a function's return type. We must `DROP FUNCTION` first, then `CREATE FUNCTION`.

```sql
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
```

**Backward Compatibility Note:** Existing code calling these functions will continue to work. The new `heading_context` column is simply returned in addition to existing columns - callers don't need code changes to call the function, only to USE the new column.

---

### Step 8: Apply database migrations

```bash
pnpm db:push
```

Or if using local Supabase:

```bash
npx supabase db push --local
```

**Expected:** Migrations applied successfully

---

### Step 9: Regenerate database types

```bash
pnpm db:types
```

**Expected:** `src/lib/supabase/database.types.ts` updated with `heading_context` column and updated function signatures.

**IMPORTANT:** Do NOT manually edit database.types.ts - it is auto-generated and manual changes will be overwritten.

---

### Step 10: Create test fixtures directory

```bash
mkdir -p src/lib/extraction/__tests__/fixtures
touch src/lib/extraction/__tests__/fixtures/.gitkeep
```

**Expected:** Fixtures directory exists for integration tests

---

### Step 11: Update chunker with Section interface and section-aware chunking

**NOTE:** This step is done BEFORE the PDF tests because pdf.ts imports `Section` from chunker.ts. This avoids a circular dependency issue where tests would fail on import.

Update `src/lib/extraction/chunker.ts`. This adds the `Section` interface and `chunkTextWithSections` function while updating `Chunk` to include `heading_context`:

```typescript
import { CHUNK_CONFIG } from '@/lib/vault/constants';

/**
 * Represents a text chunk with its content, position, and optional heading context.
 */
export interface Chunk {
  /** The text content of this chunk */
  content: string;
  /** Zero-based index indicating the chunk's position in the sequence */
  index: number;
  /** Hierarchical heading path (e.g., "Methods > Participants"), null if no section */
  heading_context: string | null;
}

/**
 * Section from PDF extraction with heading information.
 * Used by both pdf.ts and chunker.ts for consistency.
 */
export interface Section {
  level: number;
  title: string;
  heading_context: string;
  content: string;
  start_line: number;
}

/**
 * Configuration options for text chunking.
 */
export interface ChunkConfig {
  /** Maximum size of each chunk in characters (default: 2000) */
  maxSize?: number;
  /** Number of characters to overlap between chunks (default: 200) */
  overlap?: number;
  /** Minimum chunk size to avoid empty chunks (default: 50) */
  minSize?: number;
}

/**
 * Sentence ending pattern: period, exclamation, or question mark
 * followed by whitespace or end of string.
 */
const SENTENCE_END_REGEX = /[.!?](?=\s|$)/g;

/**
 * Checks if a character index is within a surrogate pair.
 */
function isWithinSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;

  const prevChar = text.charCodeAt(index - 1);
  const currentChar = text.charCodeAt(index);

  const isPrevHighSurrogate = prevChar >= 0xd800 && prevChar <= 0xdbff;
  const isCurrentLowSurrogate = currentChar >= 0xdc00 && currentChar <= 0xdfff;

  return isPrevHighSurrogate && isCurrentLowSurrogate;
}

/**
 * Finds the best position to end a chunk, preferring sentence boundaries.
 */
function findChunkEnd(text: string, start: number, maxSize: number): number {
  const maxEnd = Math.min(start + maxSize, text.length);
  const searchText = text.slice(start, maxEnd);

  if (maxEnd === text.length) {
    return maxEnd;
  }

  let bestEnd = -1;
  let match: RegExpExecArray | null;
  SENTENCE_END_REGEX.lastIndex = 0;

  while ((match = SENTENCE_END_REGEX.exec(searchText)) !== null) {
    const endPos = start + match.index + 1;
    if (endPos <= maxEnd) {
      bestEnd = endPos;
    }
  }

  if (bestEnd > start && !isWithinSurrogatePair(text, bestEnd)) {
    return bestEnd;
  }

  const lastSpace = searchText.lastIndexOf(' ');
  if (lastSpace > 0) {
    const wordBoundary = start + lastSpace + 1;
    if (!isWithinSurrogatePair(text, wordBoundary)) {
      return wordBoundary;
    }
  }

  let cutPoint = maxEnd;
  if (isWithinSurrogatePair(text, cutPoint)) {
    cutPoint--;
  }

  return cutPoint;
}

/**
 * Normalizes heading context - converts empty string to null.
 */
function normalizeHeadingContext(context: string | null | undefined): string | null {
  if (!context || context.trim() === '') {
    return null;
  }
  return context;
}

/**
 * Chunks a single piece of text (internal helper).
 */
function chunkSingleText(
  text: string,
  config: ChunkConfig,
  startIndex: number,
  headingContext: string | null
): Chunk[] {
  const maxSize = config.maxSize ?? CHUNK_CONFIG.maxSize;
  const overlap = config.overlap ?? CHUNK_CONFIG.overlap;
  const minSize = config.minSize ?? CHUNK_CONFIG.minSize;

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return [];
  }

  const normalizedContext = normalizeHeadingContext(headingContext);

  if (trimmedText.length <= maxSize && trimmedText.length >= minSize) {
    return [{ content: trimmedText, index: startIndex, heading_context: normalizedContext }];
  }

  if (trimmedText.length < minSize) {
    return [{ content: trimmedText, index: startIndex, heading_context: normalizedContext }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = startIndex;

  while (start < trimmedText.length) {
    const chunkEnd = findChunkEnd(trimmedText, start, maxSize);
    const content = trimmedText.slice(start, chunkEnd).trimEnd();

    if (content.length > 0) {
      chunks.push({ content, index, heading_context: normalizedContext });
      index++;
    }

    let nextStart = chunkEnd - overlap;

    if (nextStart <= start) {
      nextStart = chunkEnd;
    }

    if (chunkEnd >= trimmedText.length) {
      break;
    }

    start = nextStart;
  }

  return chunks;
}

/**
 * Splits text into overlapping chunks suitable for embedding.
 * This is the original function for backward compatibility.
 *
 * @param text - The text to chunk
 * @param config - Optional configuration for chunk sizes
 * @returns Array of chunks with content, sequential indices, and heading_context: null
 */
export function chunkText(text: string, config?: ChunkConfig): Chunk[] {
  return chunkSingleText(text, config ?? {}, 0, null);
}

/**
 * Chunks text with section awareness, preserving heading context.
 * Each section is chunked independently, and all chunks from a section
 * share the same heading_context.
 *
 * @param text - The full document text (used as fallback if no sections)
 * @param sections - Sections extracted from PDF with heading context
 * @param config - Optional configuration for chunk sizes
 * @returns Array of chunks with heading context preserved
 */
export function chunkTextWithSections(text: string, sections: Section[], config?: ChunkConfig): Chunk[] {
  // If no sections provided, fall back to plain chunking
  if (!sections || sections.length === 0) {
    return chunkText(text, config);
  }

  const allChunks: Chunk[] = [];
  let currentIndex = 0;

  for (const section of sections) {
    // Skip sections with no content
    if (!section.content || section.content.trim().length === 0) {
      continue;
    }

    const sectionChunks = chunkSingleText(section.content, config ?? {}, currentIndex, section.heading_context || null);

    allChunks.push(...sectionChunks);
    currentIndex += sectionChunks.length;
  }

  // If no chunks were created from sections (all empty), fall back to plain text
  if (allChunks.length === 0) {
    return chunkText(text, config);
  }

  return allChunks;
}

/**
 * Estimates the number of chunks that will be created for a given text length.
 */
export function estimateChunkCount(textLength: number): number {
  const { maxSize, overlap } = CHUNK_CONFIG;

  if (textLength <= 0) {
    return 0;
  }

  if (textLength <= maxSize) {
    return 1;
  }

  const effectiveChunkSize = maxSize - overlap;
  return Math.ceil((textLength - overlap) / effectiveChunkSize);
}
```

---

### Step 12: Add section-aware chunker tests

Add these tests to `src/lib/extraction/__tests__/chunker.test.ts`. **Merge the import** with the existing imports:

```typescript
// Update the import at the top to include new exports
import { chunkText, chunkTextWithSections, estimateChunkCount, type Section } from '../chunker';

// Add these tests at the end of the file

describe('Section-aware chunking', () => {
  it('chunks by section when sections provided', () => {
    const sections: Section[] = [
      {
        level: 1,
        title: 'Introduction',
        heading_context: 'Introduction',
        content: 'Intro content here.',
        start_line: 0,
      },
      {
        level: 2,
        title: 'Methods',
        heading_context: 'Introduction > Methods',
        content: 'Methods content.',
        start_line: 4,
      },
    ];

    const chunks = chunkTextWithSections('Full text here', sections);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].heading_context).toBe('Introduction');
    expect(chunks[1].heading_context).toBe('Introduction > Methods');
  });

  it('preserves heading context in each chunk when section spans multiple chunks', () => {
    const longContent = 'A'.repeat(3000); // Will require multiple chunks
    const sections: Section[] = [
      { level: 1, title: 'Results', heading_context: 'Results', content: longContent, start_line: 0 },
    ];

    const chunks = chunkTextWithSections(`# Results\n\n${longContent}`, sections);

    // All chunks from this section should have the same heading context
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.heading_context).toBe('Results');
    });
  });

  it('handles documents without sections', () => {
    const text = 'Just plain text without any headings.';
    const sections: Section[] = [];

    const chunks = chunkTextWithSections(text, sections);

    expect(chunks.length).toBe(1);
    expect(chunks[0].heading_context).toBeNull();
  });

  it('respects section boundaries when chunking', () => {
    const sections: Section[] = [
      { level: 1, title: 'A', heading_context: 'A', content: 'Content A.', start_line: 0 },
      { level: 1, title: 'B', heading_context: 'B', content: 'Content B.', start_line: 4 },
    ];

    const chunks = chunkTextWithSections('# A\n\nContent A.\n\n# B\n\nContent B.', sections);

    // Chunks should not span sections
    const aChunks = chunks.filter((c) => c.heading_context === 'A');
    const bChunks = chunks.filter((c) => c.heading_context === 'B');

    expect(aChunks.length).toBeGreaterThan(0);
    expect(bChunks.length).toBeGreaterThan(0);
  });

  it('handles section with empty heading_context', () => {
    const sections: Section[] = [
      { level: 0, title: '', heading_context: '', content: 'Content without heading.', start_line: 0 },
    ];

    const chunks = chunkTextWithSections('Content without heading.', sections);

    expect(chunks.length).toBe(1);
    // Empty string heading_context should be converted to null
    expect(chunks[0].heading_context).toBeNull();
  });

  it('handles deeply nested headings (6 levels)', () => {
    const sections: Section[] = [
      { level: 6, title: 'Deep', heading_context: 'A > B > C > D > E > Deep', content: 'Deep content.', start_line: 0 },
    ];

    const chunks = chunkTextWithSections('Deep content.', sections);

    expect(chunks[0].heading_context).toBe('A > B > C > D > E > Deep');
  });

  it('skips sections with empty content', () => {
    const sections: Section[] = [
      { level: 1, title: 'Empty', heading_context: 'Empty', content: '', start_line: 0 },
      { level: 1, title: 'HasContent', heading_context: 'HasContent', content: 'Real content here.', start_line: 2 },
    ];

    const chunks = chunkTextWithSections('Real content here.', sections);

    expect(chunks.length).toBe(1);
    expect(chunks[0].heading_context).toBe('HasContent');
  });
});

// Also verify that existing chunkText returns chunks with heading_context: null
describe('chunkText backward compatibility', () => {
  it('returns chunks with heading_context: null', () => {
    const chunks = chunkText('Some text content');

    expect(chunks.length).toBe(1);
    expect(chunks[0].heading_context).toBeNull();
  });
});
```

---

### Step 13: Run chunker tests

```bash
pnpm test src/lib/extraction/__tests__/chunker.test.ts
```

**Expected:** PASS - All tests pass

---

### Step 14: Replace PDF extraction tests

**IMPORTANT:** This step REPLACES the entire test file, not merges with it. The new tests have a different mocking strategy.

Replace `src/lib/extraction/__tests__/pdf.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractPdfText, extractPdfTextLegacy, type PdfExtractionResult } from '../pdf';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';

// Store mock for assertions
const mockPdfParse = vi.fn().mockImplementation(async (buffer) => {
  if (buffer.length === 0) {
    throw new Error('Empty buffer');
  }
  return { text: 'Fallback extracted text', numpages: 1 };
});

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock pdf-parse for fallback tests
vi.mock('pdf-parse', () => ({
  default: mockPdfParse,
}));

// Helper to create a mock process with proper async event emission
function createMockProcess(stdout: string, stderr: string, exitCode: number) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  // Emit events asynchronously (like real spawn)
  setImmediate(() => {
    if (stdout) proc.stdout.emit('data', stdout);
    if (stderr) proc.stderr.emit('data', stderr);
    proc.emit('close', exitCode);
  });

  return proc;
}

describe('PDF extraction with pymupdf4llm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts text and sections from valid PDF', async () => {
    const mockOutput = JSON.stringify({
      success: true,
      markdown: '# Introduction\n\nThis is the intro.\n\n## Methods\n\nThis is methods.',
      sections: [
        {
          level: 1,
          title: 'Introduction',
          heading_context: 'Introduction',
          content: 'This is the intro.',
          start_line: 0,
        },
        {
          level: 2,
          title: 'Methods',
          heading_context: 'Introduction > Methods',
          content: 'This is methods.',
          start_line: 4,
        },
      ],
      page_count: 5,
      error: null,
    });

    const mockSpawn = vi.mocked(child_process.spawn);
    mockSpawn.mockImplementation(() => createMockProcess(mockOutput, '', 0) as any);

    const result = await extractPdfText(Buffer.from('pdf content'));

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('# Introduction');
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading_context).toBe('Introduction');
    expect(result.pageCount).toBeDefined();
    expect(result.pageCount).toBe(5);
  });

  it('handles Python script errors gracefully', async () => {
    const mockSpawn = vi.mocked(child_process.spawn);
    mockSpawn.mockImplementation(() => createMockProcess('', 'Python error', 1) as any);

    const result = await extractPdfText(Buffer.from('pdf content'), { useFallback: false });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles empty buffer', async () => {
    const result = await extractPdfText(Buffer.alloc(0));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Empty buffer');
  });

  it('preserves heading context in sections', async () => {
    const mockOutput = JSON.stringify({
      success: true,
      markdown: '# Methods\n\n## Participants\n\nContent here.',
      sections: [
        { level: 1, title: 'Methods', heading_context: 'Methods', content: '', start_line: 0 },
        {
          level: 2,
          title: 'Participants',
          heading_context: 'Methods > Participants',
          content: 'Content here.',
          start_line: 2,
        },
      ],
      page_count: 1,
      error: null,
    });

    const mockSpawn = vi.mocked(child_process.spawn);
    mockSpawn.mockImplementation(() => createMockProcess(mockOutput, '', 0) as any);

    const result = await extractPdfText(Buffer.from('pdf'));

    expect(result.sections[1].heading_context).toBe('Methods > Participants');
  });

  it('handles PDF with no extractable text (image-only)', async () => {
    const mockOutput = JSON.stringify({
      success: true,
      markdown: '',
      sections: [],
      page_count: 5,
      error: null,
    });

    const mockSpawn = vi.mocked(child_process.spawn);
    mockSpawn.mockImplementation(() => createMockProcess(mockOutput, '', 0) as any);

    const result = await extractPdfText(Buffer.from('pdf'));

    expect(result.success).toBe(true);
    expect(result.markdown).toBe('');
    expect(result.sections).toHaveLength(0);
    expect(result.pageCount).toBe(5);
  });

  it('handles invalid JSON output from Python', async () => {
    const mockSpawn = vi.mocked(child_process.spawn);
    mockSpawn.mockImplementation(() => createMockProcess('not valid json {{{', '', 0) as any);

    const result = await extractPdfText(Buffer.from('pdf'), { useFallback: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain('parse');
  });

  it('handles truncated JSON output from Python', async () => {
    const mockSpawn = vi.mocked(child_process.spawn);
    mockSpawn.mockImplementation(() => createMockProcess('{"success": true, "markdown": "...', '', 0) as any);

    const result = await extractPdfText(Buffer.from('pdf'), { useFallback: false });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles spawn error (Python not found)', async () => {
    const mockSpawn = vi.mocked(child_process.spawn);
    mockSpawn.mockImplementation(() => {
      const proc = new EventEmitter() as any;
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = vi.fn();

      setImmediate(() => {
        proc.emit('error', new Error('spawn python3 ENOENT'));
      });

      return proc;
    });

    const result = await extractPdfText(Buffer.from('pdf'), { useFallback: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain('python');
  });

  it('falls back to pdf-parse when Python fails and fallback enabled', async () => {
    const mockSpawn = vi.mocked(child_process.spawn);
    mockSpawn.mockImplementation(() => createMockProcess('', 'Python crashed', 1) as any);

    const result = await extractPdfText(Buffer.from('valid pdf content'), { useFallback: true });

    // Should succeed via pdf-parse fallback
    expect(result.success).toBe(true);
    expect(result.text).toBe('Fallback extracted text');
    // Verify fallback result shape
    expect(result.sections).toHaveLength(0); // Fallback has no section awareness
    expect(result.markdown).toBe('Fallback extracted text'); // markdown equals text for fallback
    // Verify mockPdfParse was called
    expect(mockPdfParse).toHaveBeenCalled();
  });
});

describe('Legacy PDF extraction (pdf-parse)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts text from valid PDF buffer', async () => {
    const result = await extractPdfTextLegacy(Buffer.from('mock pdf'));

    expect(result.success).toBe(true);
    expect(result.text).toBe('Fallback extracted text');
    expect(mockPdfParse).toHaveBeenCalled();
  });

  it('handles empty buffer', async () => {
    const result = await extractPdfTextLegacy(Buffer.alloc(0));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Empty buffer');
  });
});
```

---

### Step 15: Implement updated PDF extractor with subprocess and fallback

Replace `src/lib/extraction/pdf.ts` with:

```typescript
import { spawn, type ChildProcess } from 'child_process';
import { writeFile, unlink, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import pdfParse from 'pdf-parse';
import { vaultLogger } from '@/lib/logger';
import type { Section } from './chunker';

/**
 * Result of PDF extraction with structured sections.
 * Uses Section interface from chunker for consistency.
 */
export interface PdfExtractionResult {
  text: string;
  markdown: string;
  sections: Section[];
  success: boolean;
  error?: string;
  pageCount?: number;
}

/**
 * Legacy interface for backward compatibility.
 */
export interface ExtractionResult {
  text: string;
  success: boolean;
  error?: string;
  pageCount?: number;
}

/**
 * Options for PDF extraction.
 */
export interface PdfExtractionOptions {
  /** Use pdf-parse fallback if Python extraction fails (default: true) */
  useFallback?: boolean;
  /** Timeout in milliseconds (default: 120000) */
  timeout?: number;
}

/**
 * Feature flag for pymupdf4llm extraction.
 * Set FEATURE_PYMUPDF_EXTRACTION=true to enable (disabled by default for safe rollout).
 *
 * NOTE: Feature is OPT-IN for gradual rollout. Set FEATURE_PYMUPDF_EXTRACTION=true
 * after validating in test environment.
 */
const USE_PYMUPDF = process.env.FEATURE_PYMUPDF_EXTRACTION === 'true';

/**
 * Path to the Python extraction script.
 *
 * IMPORTANT for serverless deployments: process.cwd() may not point to the application
 * root in environments like Vercel. Use PDF_EXTRACT_SCRIPT env var to specify the
 * absolute path to the script in production.
 */
const PYTHON_SCRIPT = process.env.PDF_EXTRACT_SCRIPT || join(process.cwd(), 'scripts', 'extract_pdf.py');

/**
 * Default timeout for Python subprocess (2 minutes).
 */
const DEFAULT_TIMEOUT_MS = 120000;

const log = vaultLogger({ operation: 'pdf-extraction' });

/**
 * Extracts text from PDF using legacy pdf-parse library.
 * Used as fallback when Python extraction fails.
 */
export async function extractPdfTextLegacy(buffer: Buffer): Promise<ExtractionResult> {
  if (!buffer || buffer.length === 0) {
    return { text: '', success: false, error: 'Empty buffer provided' };
  }

  try {
    const result = await pdfParse(buffer);
    return {
      text: result.text,
      success: true,
      pageCount: result.numpages,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown PDF parsing error';
    log.error({ error: errorMessage }, 'Legacy PDF extraction failed');
    return {
      text: '',
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Extracts text and structure from a PDF buffer using pymupdf4llm.
 * Falls back to pdf-parse if Python extraction fails (unless disabled).
 *
 * @param buffer - The PDF file as a Buffer
 * @param options - Extraction options
 * @returns PdfExtractionResult with markdown, sections, and text
 */
export async function extractPdfText(buffer: Buffer, options: PdfExtractionOptions = {}): Promise<PdfExtractionResult> {
  const { useFallback = true, timeout = DEFAULT_TIMEOUT_MS } = options;

  // Handle empty buffer
  if (!buffer || buffer.length === 0) {
    log.warn('PDF extraction failed: empty buffer');
    return {
      text: '',
      markdown: '',
      sections: [],
      success: false,
      error: 'Empty buffer provided',
    };
  }

  // Skip pymupdf4llm if feature flag is disabled
  if (!USE_PYMUPDF) {
    log.info('pymupdf4llm disabled, using pdf-parse');
    return convertLegacyResult(await extractPdfTextLegacy(buffer));
  }

  let tempDir: string | null = null;
  let tempFile: string | null = null;

  try {
    // Create temp file for the PDF
    tempDir = await mkdtemp(join(tmpdir(), 'quill-pdf-'));
    tempFile = join(tempDir, 'input.pdf');
    await writeFile(tempFile, buffer, { mode: 0o600 }); // Restrictive permissions

    // Call Python script
    const result = await runPythonExtraction(tempFile, timeout);

    if (result.success) {
      return result;
    }

    // Python failed - try fallback if enabled
    if (useFallback) {
      log.warn({ error: result.error }, 'pymupdf4llm failed, falling back to pdf-parse');
      return convertLegacyResult(await extractPdfTextLegacy(buffer));
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown PDF parsing error';
    log.error({ error: errorMessage }, 'PDF extraction failed');

    // Try fallback on any error
    if (useFallback) {
      log.warn('Attempting pdf-parse fallback after error');
      try {
        return convertLegacyResult(await extractPdfTextLegacy(buffer));
      } catch (fallbackErr) {
        log.error({ error: fallbackErr }, 'Fallback also failed');
      }
    }

    return {
      text: '',
      markdown: '',
      sections: [],
      success: false,
      error: errorMessage,
    };
  } finally {
    // Cleanup temp files
    if (tempFile) {
      try {
        await unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Converts legacy ExtractionResult to PdfExtractionResult.
 */
function convertLegacyResult(legacy: ExtractionResult): PdfExtractionResult {
  return {
    text: legacy.text,
    markdown: legacy.text, // No markdown formatting from pdf-parse
    sections: [], // No section awareness from pdf-parse
    success: legacy.success,
    error: legacy.error,
    pageCount: legacy.pageCount,
  };
}

/**
 * Runs the Python extraction script and parses output.
 * Implements proper timeout handling with SIGTERM/SIGKILL.
 */
async function runPythonExtraction(pdfPath: string, timeout: number): Promise<PdfExtractionResult> {
  return new Promise((resolve) => {
    let resolved = false;
    let proc: ChildProcess | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let killTimeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (killTimeoutId) clearTimeout(killTimeoutId);
    };

    const resolveOnce = (result: PdfExtractionResult) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    try {
      proc = spawn('python3', [PYTHON_SCRIPT, pdfPath]);
    } catch (err) {
      resolveOnce({
        text: '',
        markdown: '',
        sections: [],
        success: false,
        error: `Failed to spawn Python: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
      return;
    }

    let stdout = '';
    let stderr = '';

    // Set up timeout with SIGTERM, then SIGKILL
    timeoutId = setTimeout(() => {
      log.warn({ timeout }, 'Python extraction timed out, sending SIGTERM');
      proc?.kill('SIGTERM');

      // Give it 5 seconds to cleanup, then force kill
      killTimeoutId = setTimeout(() => {
        // Check if already resolved to avoid incorrect warning log
        if (!resolved) {
          log.warn('Python process did not exit, sending SIGKILL');
          proc?.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      log.error({ error: err.message }, 'Failed to spawn Python process');
      resolveOnce({
        text: '',
        markdown: '',
        sections: [],
        success: false,
        error: `Failed to run Python script: ${err.message}. Is python3 installed?`,
      });
    });

    proc.on('close', (code) => {
      if (resolved) return; // Already handled by error event

      cleanup();

      if (code !== 0) {
        log.error({ code, stderr }, 'Python script exited with error');
        resolveOnce({
          text: '',
          markdown: '',
          sections: [],
          success: false,
          error: stderr || `Python script exited with code ${code}`,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout);

        if (!result.success) {
          resolveOnce({
            text: '',
            markdown: '',
            sections: [],
            success: false,
            error: result.error || 'Extraction failed',
          });
          return;
        }

        // Convert markdown to plain text for backward compatibility
        const plainText = result.markdown
          .replace(/^#{1,6}\s+/gm, '') // Remove heading markers
          .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.+?)\*/g, '$1') // Remove italic
          .replace(/`(.+?)`/g, '$1') // Remove code
          .trim();

        resolveOnce({
          text: plainText,
          markdown: result.markdown,
          sections: result.sections || [],
          success: true,
          pageCount: result.page_count,
        });
      } catch (parseErr) {
        log.error({ error: parseErr, stdout: stdout.slice(0, 500) }, 'Failed to parse Python output');
        resolveOnce({
          text: '',
          markdown: '',
          sections: [],
          success: false,
          error: `Failed to parse extraction output: ${parseErr instanceof Error ? parseErr.message : 'invalid JSON'}`,
        });
      }
    });
  });
}
```

---

### Step 16: Run PDF tests

```bash
pnpm test src/lib/extraction/__tests__/pdf.test.ts
```

**Expected:** PASS - All tests pass

---

### Step 17: Update index.ts exports

Update `src/lib/extraction/index.ts`. This shows the **final state** of the file - the key changes are adding `extractPdfTextLegacy`, `PdfExtractionResult`, `PdfExtractionOptions`, `chunkTextWithSections`, and `Section`:

```typescript
export {
  extractPdfText,
  extractPdfTextLegacy,
  type PdfExtractionResult,
  type ExtractionResult,
  type PdfExtractionOptions,
} from './pdf';
export { extractDocxText } from './docx';
export { extractTextContent } from './text';
export {
  chunkText,
  chunkTextWithSections,
  estimateChunkCount,
  type Chunk,
  type Section,
  type ChunkConfig,
} from './chunker';
export { getEmbedding, getEmbeddings } from './embeddings';
export { processExtraction, type ProcessExtractionResult } from './processor';
```

---

### Step 18: Update processor to use section-aware chunking

Update `src/lib/extraction/processor.ts`. Make these specific changes:

**1. Update imports at top of file:**

Find the existing imports and update to:

```typescript
import { createClient } from '@/lib/supabase/server';
import { getVaultItem, updateVaultItemStatus } from '@/lib/api/vault';
import { extractPdfText, type PdfExtractionResult, type ExtractionResult } from '@/lib/extraction/pdf';
import { extractDocxText } from '@/lib/extraction/docx';
import { extractTextContent } from '@/lib/extraction/text';
import { chunkText, chunkTextWithSections, type Chunk } from '@/lib/extraction/chunker';
import { getEmbeddings } from '@/lib/extraction/embeddings';
import { vaultLogger } from '@/lib/logger';
import { VAULT_STORAGE_BUCKET } from '@/lib/vault/constants';
```

**2. Update extractByType return type and implementation:**

Replace the existing `extractByType` function with:

```typescript
/**
 * Result that may include sections (for PDFs) or just basic extraction.
 */
type ExtractResult = PdfExtractionResult | ExtractionResult;

/**
 * Selects the appropriate extractor based on file type.
 *
 * @param fileType - The type of file (pdf, docx, txt)
 * @param buffer - The file contents as a Buffer
 * @returns ExtractResult from the appropriate extractor
 */
async function extractByType(fileType: string, buffer: Buffer): Promise<ExtractResult> {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return extractPdfText(buffer);
    case 'docx':
      return extractDocxText(buffer);
    case 'txt':
    case 'text':
      return extractTextContent(buffer);
    default:
      return {
        text: '',
        success: false,
        error: `Unsupported file type: ${fileType}`,
      };
  }
}
```

**3. Update insertChunks to include heading_context:**

Replace the existing `insertChunks` function with:

```typescript
/**
 * Inserts chunks with embeddings into the vault_chunks table.
 *
 * @param vaultItemId - The ID of the vault item
 * @param chunks - Array of chunks with content, index, and heading_context
 * @param embeddings - Array of embedding vectors
 */
async function insertChunks(vaultItemId: string, chunks: Chunk[], embeddings: number[][]): Promise<void> {
  const supabase = await createClient();

  const chunkRecords = chunks.map((chunk, i) => ({
    vault_item_id: vaultItemId,
    content: chunk.content,
    chunk_index: chunk.index,
    heading_context: chunk.heading_context,
    embedding: JSON.stringify(embeddings[i]),
  }));

  const { error } = await supabase.from('vault_chunks').insert(chunkRecords).select();

  if (error) {
    throw new Error(`Failed to insert chunks: ${error.message}`);
  }
}
```

**4. Update the chunking step in processExtraction:**

Find the line that says `const chunks = chunkText(text);` and replace it with:

```typescript
let chunks: Chunk[];

// Use section-aware chunking for PDFs with sections
// The 'sections' property only exists on PdfExtractionResult, not basic ExtractionResult
if (
  'sections' in extractionResult &&
  Array.isArray(extractionResult.sections) &&
  extractionResult.sections.length > 0
) {
  // Note: 'text' parameter is only used as fallback if sections are empty
  chunks = chunkTextWithSections(text, extractionResult.sections);
} else {
  chunks = chunkText(text);
}
```

---

### Step 19: Update processor tests (if they exist)

Check if `src/lib/extraction/__tests__/processor.test.ts` exists. If it does, update it to handle the new types:

1. Update mocks for `chunkText` to return chunks with `heading_context: null`
2. Add test for section-aware chunking path when `extractPdfText` returns sections
3. Verify `insertChunks` includes `heading_context` in the inserted records

If the file doesn't exist, skip this step.

---

### Step 20: Update SearchResult type

Update `src/lib/vault/types.ts` to add `headingContext`:

Find the `SearchResult` interface and update it to:

```typescript
export interface SearchResult {
  content: string;
  similarity: number;
  vaultItemId: string;
  filename: string;
  chunkIndex: number;
  headingContext: string | null;
}
```

---

### Step 21: Update search.ts with headingContext support

Update `src/lib/api/search.ts` to include `headingContext` in all search modes:

**1. Update SearchVaultChunksRow interface:**

```typescript
interface SearchVaultChunksRow {
  content: string;
  similarity: number;
  vault_item_id: string;
  filename: string;
  chunk_index: number;
  heading_context: string | null;
}
```

**2. Update SearchVaultChunksKeywordRow interface:**

```typescript
interface SearchVaultChunksKeywordRow {
  content: string;
  vault_item_id: string;
  filename: string;
  chunk_index: number;
  match_rank: number;
  heading_context: string | null;
}
```

**3. Update transformToSearchResult function:**

```typescript
function transformToSearchResult(row: SearchVaultChunksRow): SearchResult {
  return {
    content: row.content,
    similarity: row.similarity,
    vaultItemId: row.vault_item_id,
    filename: row.filename,
    chunkIndex: row.chunk_index,
    headingContext: row.heading_context,
  };
}
```

**4. Update searchVaultKeyword function's inline transform:**

Find the `.map()` call in `searchVaultKeyword` that creates results and update it:

```typescript
const results: SearchResult[] = (data as SearchVaultChunksKeywordRow[]).map((row) => ({
  content: row.content,
  similarity: row.match_rank / maxRank, // Normalize to 0-1 range
  vaultItemId: row.vault_item_id,
  filename: row.filename,
  chunkIndex: row.chunk_index,
  headingContext: row.heading_context,
}));
```

**5. Update searchVaultHybrid function's merge logic:**

Find the merge/map logic in `searchVaultHybrid` and update it to preserve `headingContext`:

```typescript
// Merge results using a map keyed by vaultItemId + chunkIndex
const resultMap = new Map<string, SearchResult & { semanticScore: number; keywordScore: number }>();

// Add semantic results
for (const result of semanticResults) {
  const key = `${result.vaultItemId}-${result.chunkIndex}`;
  resultMap.set(key, {
    ...result,
    semanticScore: result.similarity,
    keywordScore: 0,
  });
}

// Merge keyword results
for (const result of keywordResults) {
  const key = `${result.vaultItemId}-${result.chunkIndex}`;
  const existing = resultMap.get(key);
  if (existing) {
    // Chunk found in both - boost the score
    existing.keywordScore = result.similarity;
  } else {
    // Keyword-only result
    resultMap.set(key, {
      ...result,
      semanticScore: 0,
      keywordScore: result.similarity,
    });
  }
}

// Calculate combined score and sort
const SEMANTIC_WEIGHT = 0.4;
const KEYWORD_WEIGHT = 0.6;

const mergedResults = Array.from(resultMap.values())
  .map((r) => ({
    content: r.content,
    vaultItemId: r.vaultItemId,
    filename: r.filename,
    chunkIndex: r.chunkIndex,
    headingContext: r.headingContext,
    similarity: r.semanticScore * SEMANTIC_WEIGHT + r.keywordScore * KEYWORD_WEIGHT,
  }))
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, limit);
```

---

### Step 22: Update search tests (if they exist)

Check if `src/lib/api/__tests__/search.test.ts` exists. If it does, update test assertions to include `headingContext` in expected results:

```typescript
expect(results[0]).toMatchObject({
  content: expect.any(String),
  similarity: expect.any(Number),
  vaultItemId: expect.any(String),
  filename: expect.any(String),
  chunkIndex: expect.any(Number),
  headingContext: expect.toBeOneOf([expect.any(String), null]),
});
```

If the file doesn't exist, skip this step.

---

### Step 23: Run all extraction tests

```bash
pnpm test src/lib/extraction/
```

**Expected:** PASS - All tests pass

---

### Step 24: Run type check

```bash
pnpm tsc --noEmit
```

Or if the project has a typecheck script:

```bash
pnpm typecheck
```

**Expected:** No type errors related to the changes (some pre-existing errors may exist)

---

### Step 25: Commit all changes

```bash
git add scripts/ src/lib/extraction/ src/lib/api/search.ts src/lib/vault/types.ts supabase/migrations/
git commit -m "feat: enhance PDF extraction with pymupdf4llm and section-aware chunking

- Add Python extraction script using pymupdf4llm with structured logging
- Implement proper subprocess timeout handling (SIGTERM/SIGKILL)
- Add pdf-parse fallback for graceful degradation
- Add feature flag (FEATURE_PYMUPDF_EXTRACTION) for gradual rollout (opt-in)
- Add section-aware chunking with heading context preservation
- Update all search functions to return headingContext
- Add heading_context column to vault_chunks table
- Add comprehensive tests including edge cases
- Maintain backward compatibility for DOCX and TXT files"
```

---

## Rollback Instructions

If something goes wrong during deployment:

### Code Rollback

```bash
# Revert all code changes
git checkout HEAD~1 -- src/lib/extraction/ src/lib/api/search.ts src/lib/vault/types.ts

# Remove Python scripts
rm -f scripts/extract_pdf.py scripts/requirements.txt
```

### Database Rollback

Create a down migration if needed:

```sql
-- Rollback: Remove heading_context column
ALTER TABLE vault_chunks DROP COLUMN IF EXISTS heading_context;

-- Rollback: Restore original search functions (without heading_context)
-- Check supabase/migrations/ for the original function definitions
-- Copy from the migration that originally created search_vault_chunks
-- (before heading_context was added)
```

### Feature Flag Escape Hatch

If the new extraction is causing issues in production but database changes are already applied:

```bash
# Disable pymupdf4llm, use only pdf-parse (this is the default)
FEATURE_PYMUPDF_EXTRACTION=false
```

This will bypass the Python subprocess and use the legacy pdf-parse extraction while keeping the database schema intact. Since the feature is opt-in, simply removing or not setting the env var also disables it.

---

## Existing Data Migration

After deploying this change, existing `vault_chunks` rows will have `heading_context = NULL`. This is acceptable because:

- Search functions handle NULL heading_context gracefully
- New uploads will have heading context populated (if pymupdf4llm enabled)
- The UI should handle NULL heading context (show nothing or a default)

**Optional:** To add heading context to existing documents:

1. Delete existing chunks for a vault item
2. Re-trigger extraction by setting the item status to 'pending'
3. The processor will re-extract with the new section-aware chunking

---

## Verification Checklist

### Python Script

- [ ] `scripts/requirements.txt` exists with pinned `pymupdf4llm==0.0.17`
- [ ] `scripts/extract_pdf.py` exists and is executable
- [ ] Python script has Python 3.9+ version check
- [ ] Python script outputs valid JSON with markdown and sections
- [ ] Python script uses `os.path.realpath()` for path validation (security)
- [ ] Python script checks `real_path.startswith(real_temp + os.sep)` (security)
- [ ] Python script has structured logging to stderr

### TypeScript Implementation

- [ ] `src/lib/extraction/pdf.ts` implements proper timeout (setTimeout + SIGTERM/SIGKILL)
- [ ] `src/lib/extraction/pdf.ts` has `if (!resolved)` check before SIGKILL log
- [ ] `src/lib/extraction/pdf.ts` has fallback to pdf-parse
- [ ] `src/lib/extraction/pdf.ts` has feature flag support (opt-in: `=== 'true'`)
- [ ] `src/lib/extraction/pdf.ts` has spawn error event properly (resolveOnce pattern)
- [ ] `src/lib/extraction/pdf.ts` imports `Section` from chunker (not duplicate interface)
- [ ] `src/lib/extraction/pdf.ts` documents PDF_EXTRACT_SCRIPT env var for serverless
- [ ] `src/lib/extraction/chunker.ts` has `Section` interface
- [ ] `src/lib/extraction/chunker.ts` has `chunkTextWithSections` function
- [ ] `src/lib/extraction/chunker.ts` `chunkText` returns `heading_context: null`
- [ ] `src/lib/extraction/index.ts` exports new types and functions

### Search Updates

- [ ] `src/lib/api/search.ts` `SearchVaultChunksRow` has `heading_context`
- [ ] `src/lib/api/search.ts` `SearchVaultChunksKeywordRow` has `heading_context`
- [ ] `src/lib/api/search.ts` `transformToSearchResult` includes `headingContext`
- [ ] `src/lib/api/search.ts` `searchVaultKeyword` inline transform includes `headingContext`
- [ ] `src/lib/api/search.ts` `searchVaultHybrid` merge preserves `headingContext`
- [ ] `src/lib/vault/types.ts` `SearchResult` has `headingContext: string | null`

### Database

- [ ] Migration adds `heading_context` column to `vault_chunks` with `DEFAULT NULL`
- [ ] Migration uses `DROP FUNCTION` before `CREATE FUNCTION` (return type change)
- [ ] Migration updates `search_vault_chunks` to return `heading_context`
- [ ] Migration updates `search_vault_chunks_keyword` to return `heading_context`
- [ ] Migrations include `GRANT EXECUTE` after function creation
- [ ] `pnpm db:types` regenerated database types (NOT manual edit)

### Tests

- [ ] PDF tests REPLACE existing file (not merge)
- [ ] PDF tests store mock function in variable for assertions
- [ ] PDF tests verify fallback result includes `sections: []` and `markdown`
- [ ] PDF tests cover: valid extraction, empty PDF, image-only PDF, invalid JSON, spawn error, fallback
- [ ] PDF tests mock both `child_process.spawn` and `pdf-parse`
- [ ] Chunker tests cover: section-aware chunking, heading context preservation, backward compatibility
- [ ] Chunker tests merge import with existing imports
- [ ] Test fixtures directory exists: `src/lib/extraction/__tests__/fixtures/`
- [ ] All test commands use `pnpm test` (not `npm test`)
- [ ] All tests pass

### Backward Compatibility

- [ ] DOCX and TXT files continue to work
- [ ] `chunkText` returns chunks with `heading_context: null`
- [ ] `ExtractionResult` type still exported for backward compatibility

---

## Deployment Notes

### Python Dependencies

The deployment environment needs Python 3.9+ with pymupdf4llm installed.

**For local development:**

```bash
pip install -r scripts/requirements.txt
```

**For Docker deployments**, add to Dockerfile:

```dockerfile
# Install Python with version pinning
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment (best practice)
RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies (cached layer)
COPY scripts/requirements.txt /app/scripts/
RUN pip install --no-cache-dir -r /app/scripts/requirements.txt

# Copy extraction script
COPY scripts/extract_pdf.py /app/scripts/
RUN chmod +x /app/scripts/extract_pdf.py
```

### Environment Variables

| Variable                     | Default                        | Description                                                  |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------ |
| `FEATURE_PYMUPDF_EXTRACTION` | `false` (disabled)             | Set to `true` to enable pymupdf4llm extraction               |
| `PDF_EXTRACT_SCRIPT`         | `{cwd}/scripts/extract_pdf.py` | Override path to Python script (**required for serverless**) |

### Gradual Rollout

**IMPORTANT:** The feature is DISABLED by default (opt-in). For gradual rollout:

1. Deploy code changes (feature flag defaults to off)
2. Apply database migrations (safe - just adds column and updates functions)
3. Monitor error rates with pdf-parse
4. Enable feature flag for a test environment: `FEATURE_PYMUPDF_EXTRACTION=true`
5. Validate extraction quality with sample PDFs
6. Roll out to production by setting `FEATURE_PYMUPDF_EXTRACTION=true`

### Performance Expectations

- **Cold start latency:** ~1-2 seconds for first PDF (Python + module loading)
- **Subsequent PDFs:** ~0.5-2 seconds depending on size
- **Memory usage:** ~200-500MB per Python process for typical academic papers
- **Concurrency:** Each extraction spawns a new process; consider limiting concurrent extractions in high-load scenarios

---

## Next Steps

After this task, proceed to **[Task 99: Verification](./99-verification.md)** to validate the full Knowledge Vault implementation.
