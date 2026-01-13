# Quill: AI-Powered Document Editor for Academic Grant Writing

## Overview

Quill is an AI-native document editor designed for individual researchers writing academic grants. Inspired by Type.ai, it combines a clean writing surface with context-aware AI assistance powered by uploaded reference materials.

## Target User

Individual researchers writing their own grants. The tool supports the full grant writing lifecycle: planning, drafting, and revision.

## Core AI Interactions

| Mode | Trigger | Scope | Example |
|------|---------|-------|---------|
| **Selection** | Highlight text + toolbar | Just the selection | "Make this clearer" |
| **Cursor** | `Cmd+K` at insertion point | Generate at cursor | "Write a transition paragraph" |
| **Chat - Discussion** | Sidebar question | Read-only analysis | "Is my aims section persuasive?" |
| **Chat - Global Edit** | Sidebar command | Whole document | "Shorten everything to fit 12 pages" |
| **Chat - Research** | Sidebar question | External sources | "Find citations on CAR-T efficacy" |

### Selection Actions

When highlighting text, a floating toolbar appears with:
- **Refine** - improve clarity, grammar, conciseness
- **Extend** - expand the idea with more detail
- **Shorten** - compress while preserving meaning
- **Simplify** - reduce jargon, improve readability
- **Custom** - type your own instruction

**Interaction details:**
- Toolbar appears on selection, but AI does NOT auto-trigger
- User must click an action to initiate generation
- `Escape` dismisses the toolbar without action
- Cancel button available during generation (graceful rollback)
- If selection spans multiple sections, AI treats as single unit

### Cursor Generation

Press `Cmd+K` to open a prompt box. Describe what to write, AI generates at cursor position using surrounding context and Knowledge Vault.

**Interaction details:**
- Optional length hint dropdown: sentence / paragraph / section
- Generated content appears in a **preview panel** (not directly inserted)
- Preview panel offers: Accept / Edit / Regenerate
- `Escape` cancels without insertion
- Cursor snaps to word boundary (no mid-word insertion)

### Document Chat

Right sidebar with conversational AI that understands the entire document. Supports:
- Questions about the document ("Does my methodology address sample size concerns?")
- Global edit commands ("Remove passive voice throughout")
- Research queries ("Find recent papers on transformer architectures")

**Mode disambiguation:**
- Chat displays mode indicator: "Discussing document" / "Editing document" / "Searching sources"
- When AI detects a global edit intent, it confirms before proceeding: "This looks like a global edit. I'll modify sections 2, 4, 7. Proceed?"
- Research results visually distinct (different background, citation styling)
- User can reference another document in the project: "Compare this to my Aims section" via @-mention picker

**Empty document handling:**
- Chat offers to help start: "I can help you outline based on your RFP. Want me to suggest a structure?"
- Cursor mode works with empty context (generates based on vault/RFP only)

### Global Edits

AI proposes changes with a diff view (green additions, red deletions). User can accept/reject individually or in bulk. Before applying, AI shows which sections will be affected.

**Interaction details:**
- Document locked during global edit generation (no concurrent editing)
- Diff panel shows surrounding context for each change
- "Jump to next change" navigation
- Partial acceptance allowed; AI warns if this may create inconsistencies
- Undo is granular (can undo individual accepted changes)

## Research & Citations

Users can ask content questions in the chat sidebar:
- "What's the current success rate for CAR-T therapy in solid tumors?"
- "Find recent papers on transformer architectures for protein folding"

The AI searches academic sources (Semantic Scholar for MVP) and returns:
- Synthesized answer
- Relevant citations with titles, authors, year, DOI
- Option to insert citation directly into document

**Citation integrity (v1):**
- Only citations with verified DOIs from Semantic Scholar API are returned
- Each citation displays clickable DOI link for user verification
- Citations visually marked as "Verified" (from API) vs "Manual" (user-added)
- AI cannot synthesize/hallucinate citations; it only returns real API results

Citations are auto-formatted and added to a document-level reference list. Fetched papers can be added to the Knowledge Vault for future context.

## Knowledge Vault

Users upload reference materials that ground all AI generation and refinement:
- RFP/funding announcements
- Prior successful grants
- Research papers
- CVs and biosketches
- Preliminary data and figures
- Institutional boilerplate
- URLs to published papers

### Structure

- **Per-project vault**: RFP and project-specific materials
- **Personal vault**: CV, boilerplate, commonly-referenced papers (shared across projects)

### Processing

Documents are chunked and embedded for semantic search. When generating or refining, AI automatically pulls relevant context. Users can also explicitly reference materials ("Use my 2023 R01 as a model for tone").

**Extraction pipeline:**
- PDF text extraction via `pdf-parse`
- DOCX extraction via `mammoth`
- Fallback: user prompted to paste text manually if extraction fails

**User feedback:**
- Each vault item shows extraction status: Success / Partial / Failed
- Preview of extracted text available (first ~500 chars)
- Chunk count displayed ("Split into 47 chunks")
- Re-process option if extraction quality is poor

## Technical Architecture

### Stack

- **Frontend**: Next.js with TipTap (ProseMirror-based) editor
- **Backend**: Next.js API Routes + Supabase
- **AI**: Claude Code CLI via subprocess (leverages existing Claude subscription)

### Claude Code CLI Integration

API routes spawn Claude Code CLI as a subprocess, passing document context and instructions via stdin/files. This approach:
- Leverages existing Claude Pro/Team subscription (no separate API costs)
- Provides access to Claude's full capabilities
- Can be swapped to direct Anthropic API later if needed for scale

**CLI Protocol:**
```
Invocation: claude -p "<system prompt>" --output-format stream-json
Input: Context passed via temporary file referenced in prompt
Output: Streamed JSON parsed line-by-line
Timeout: 120s for selection/cursor, 300s for global edits
```

**Streaming:** AI responses stream to UI as generated via CLI stdout pipe. Users see text appear progressively, not after full completion.

**Error Handling:**
| Error | User Message | Action |
|-------|--------------|--------|
| CLI not found | "AI service unavailable" | Show setup instructions |
| Auth failure | "Please check Claude subscription" | Link to Claude settings |
| Timeout | "Generation timed out" | Offer retry with shorter scope |
| Rate limit | "Too many requests, please wait" | Show cooldown timer |
| Malformed output | "AI response error" | Auto-retry once, then show error |

**Context Management:** For long documents, the system sends relevant sections rather than full content:
- Current section being edited (always included)
- Surrounding sections for context (truncated if needed)
- Top-N relevant vault chunks by semantic similarity
- Recent chat history (summarized if long)

### Supabase Services

- Auth for user accounts (email magic link for v1)
- Postgres for data
- Storage for uploaded files
- pgvector for embedding search

**Embedding model:** OpenAI `text-embedding-3-small` (1536 dimensions). All vault items re-embedded on model change.

### Data Model

```sql
users
  - id, email, name, created_at

projects
  - id, user_id, title, status (draft/submitted/funded)
  - created_at, updated_at

documents
  - id, project_id, title
  - content (JSON - TipTap editor state, max 500KB)
  - content_text (extracted plaintext for search)
  - sort_order, version, created_at, updated_at

vault_items
  - id, user_id, project_id (null = personal vault)
  - type (pdf, docx, url, text)
  - filename, storage_path, extracted_text
  - extraction_status (success/partial/failed)
  - chunk_count
  - created_at

vault_chunks
  - id, vault_item_id, content, embedding (vector(1536))
  - chunk_index

citations
  - id, project_id, title, authors, year, journal
  - doi, url, abstract
  - source (user_added, ai_fetched)
  - verified (boolean - true if DOI confirmed via API)

chat_history
  - id, project_id, document_id (nullable - for document-specific chat)
  - role (user/assistant), content
  - created_at

ai_operations
  - id, document_id, operation_type (selection/cursor/global)
  - input_summary (what was sent to AI)
  - output_content (what AI returned)
  - status (pending/accepted/rejected/partial)
  - snapshot_before (document content before edit)
  - created_at
```

**Document schema:** Uses TipTap default ProseMirror schema with standard nodes (paragraph, heading, list, code, blockquote, table). Custom nodes added only as needed.

### Document Processing Pipeline

```
Upload → Extract text → Chunk → Embed → Store
                                    ↓
              Query at generation time via semantic search
```

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Logo    Project: NIH R01 Grant    [Vault] [Export] [Save]  │
├─────────────┬───────────────────────────────────┬───────────┤
│             │                               │               │
│  Documents  │         Editor                │    Chat       │
│             │                               │               │
│  • Aims     │   [Selection toolbar on       │  Ask about    │
│  • Strategy │    highlight]                 │  the document │
│  • Budget   │                               │               │
│             │   Cmd+K for cursor gen        │  Give global  │
│  [+ Add]    │                               │  commands     │
│             │                               │               │
│             │                               │  Fetch        │
│             │                               │  citations    │
│             │                               │               │
├─────────────┴───────────────────────────────┴───────────────┤
│  [Diff review panel - appears when AI proposes changes]     │
└─────────────────────────────────────────────────────────────┘
```

- Left sidebar: document list within project
- Center: distraction-free editor
- Right sidebar: AI chat (collapsible)
- Bottom: diff panel slides up when reviewing AI edits

## Phased Roadmap

### v1 (MVP)

**Core Features:**
- Single-user (no collaboration)
- Core editor with selection/cursor/chat AI modes
- Knowledge Vault with file uploads
- Global edit commands with diff review
- Basic citation fetching (Semantic Scholar, verified DOIs only)
- Export to DOCX/PDF

**Essential UX (from critique):**
- Word/page count display with configurable limits and warnings
- Basic undo for AI changes (auto-snapshot before AI edits via `ai_operations` table)
- Streaming AI responses (text appears progressively)
- Preview panel for cursor generation (Accept/Edit/Regenerate)
- Global edit confirmation ("I'll modify sections 2, 4, 7. Proceed?")
- Selection toolbar requires explicit action (no auto-trigger)
- Chat mode indicator and confirmation for global edits
- Vault extraction status feedback (success/partial/failed)
- Lightweight cross-document reference via @-mention in chat

**MVP Simplifications:**
- Simple flat vault (no tags/folders)
- Export produces clean output but may need manual formatting adjustment

---

### v2 (Polish & Trust)

**Version Control:**
- Full version history with visual diffs
- Named checkpoints ("Pre-review draft")
- Compare any two versions

**Vault Improvements:**
- "Sources used" display after AI generation
- Tag/folder organization within vaults
- Exclude items from AI context without deleting
- Search within vault items

**AI Transparency:**
- Optional "Show reasoning" for AI responses
- Writing style settings (formal/accessible, concise/detailed)
- Citation verification workflow (DOI links, manual editing)

**Grant-Specific:**
- Cross-document consistency checking
- Full-grant context option for AI (with smart truncation)

---

### v3 (Professional Features)

**Compliance & Formatting:**
- Funder profiles (NIH, NSF, DOE preset formatting)
- Real-time compliance validation
- Section completeness tracking against RFP requirements

**Resubmission Support:**
- Import prior submission + reviewer feedback
- Track all changes since prior version
- Generate "Introduction" summary of changes

**Workflow:**
- Deadline management with reminders
- Project dashboard view
- Onboarding flow for new users

---

### v4+ (Scale & Collaboration)

- Multiple AI models (GPT option, direct Anthropic API)
- Real-time collaboration
- Offline support with sync
- Rate limiting and usage tracking
- Advanced security (sandboxed file extraction)
- Direct submission integrations
- Biosketch builder
- Budget worksheet integration

---

## Known Limitations & Trade-offs

### Claude Code CLI Approach

**Trade-offs accepted for MVP:**
- Single-user focused (CLI not designed for concurrent users)
- Slightly higher latency than direct API
- Requires Claude subscription on the server

**Mitigations:**
- Context management layer prevents token overflow
- Auto-retry on transient failures
- Architected for easy swap to direct API if needed

### Context Window Management

For documents exceeding context limits:
- AI operates on current section + relevant context
- Global edits process document in chunks
- User warned when full-document operations may be truncated

### Citation Accuracy

AI-fetched citations only come from Semantic Scholar API with verified DOIs:
- v1: Only real API results returned (no AI-synthesized citations)
- v1: Each citation shows clickable DOI for user verification
- v2: Enhanced verification workflow, additional sources (PubMed, Crossref)
