# Knowledge Base Guide

How to maintain and extend the RAG knowledge base for ShipSmart's AI advisor.

---

## Overview

The knowledge base is a collection of Markdown and plain text documents stored in `apps/api-python/data/documents/`. These documents are ingested at startup (or via the `/api/v1/rag/ingest` endpoint), chunked, embedded, and stored in the vector store. When a user asks the advisor a question, the RAG pipeline retrieves the most relevant chunks as context for the LLM.

## File Location

```
apps/api-python/data/documents/
├── carriers/          # Carrier-specific overviews and details
├── guides/            # How-to guides and decision frameworks
├── scenarios/         # Common shipping scenarios and tradeoffs
└── policies/          # Carrier policies, comparisons, compliance
```

## How to Add a New Document

1. Choose the appropriate subdirectory based on content type
2. Create a `.md` or `.txt` file with a descriptive name (use kebab-case)
3. Write clear, factual content organized with headers and short paragraphs
4. Restart the Python API or call `POST /api/v1/rag/ingest` to re-ingest
5. Test retrieval with sample questions: `POST /api/v1/rag/query`

## Writing Guidelines

### Do
- Write in clear, factual language
- Use headers (##, ###) to organize content — chunking respects text boundaries
- Include specific numbers, limits, and facts (not vague statements)
- Cover both the "what" and the "when to use" for any carrier or service
- Include practical advice users can act on
- Keep paragraphs short (3-5 sentences) — this improves chunk quality

### Don't
- Don't include promotional language or marketing copy
- Don't include information that changes frequently (prices, exact surcharge amounts that fluctuate)
- Don't duplicate content across documents — each topic should live in one place
- Don't write extremely long documents — split into focused topics instead
- Don't include code, API documentation, or developer-focused content

### Optimal Document Size
- Target: 500-3000 words per document
- Shorter documents (under 500 words) may not produce enough chunks for diverse retrieval
- Very long documents (over 5000 words) are better split into focused sub-topics

## Chunking Behavior

Documents are chunked by character count with overlap:
- **Chunk size**: 500 characters (configurable via `RAG_CHUNK_SIZE`)
- **Overlap**: 50 characters (configurable via `RAG_CHUNK_OVERLAP`)
- Headers and paragraph breaks within chunks are preserved
- Source metadata includes the relative file path (e.g., `carriers/ups-overview.md`)

## Testing New Content

After adding documents:

```bash
# Ingest
curl -X POST http://localhost:8000/api/v1/rag/ingest

# Test retrieval
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "your test question here"}'
```

Check:
- Are relevant chunks returned as sources?
- Is the source path correct (includes subdirectory)?
- Does the answer reference the new content?

## Current Limitations

- **No metadata filtering**: Retrieval searches all chunks regardless of category. There is no way to restrict retrieval to a specific subdirectory or topic.
- **Hash-based embeddings**: With `LocalHashEmbedding`, retrieval is keyword-matching quality. Semantic retrieval requires `EMBEDDING_PROVIDER=openai`.
- **In-memory store**: Chunks are re-ingested on every restart. Fast for the current corpus size (~150 chunks) but would need a persistent store for thousands of chunks.
- **No deduplication**: If the same content appears in two documents, both will be chunked and stored. Avoid duplication in source content.
