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
        # Suppress stdout during extraction (pymupdf4llm prints progress bars)
        import io
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            markdown = pymupdf4llm.to_markdown(str(path))
        finally:
            sys.stdout = old_stdout

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
