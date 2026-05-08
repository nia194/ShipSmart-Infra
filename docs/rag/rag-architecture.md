# RAG Architecture

## Overview

The Python API includes a Retrieval-Augmented Generation (RAG) pipeline that ingests documents, chunks and embeds them, stores embeddings in a vector store, and retrieves relevant context to augment LLM queries.

## Pipeline Flow

```
Documents (.txt, .md)
  → load_documents()        # Read files from data/documents/
  → chunk_text()            # Split into overlapping chunks (500 chars, 50 overlap)
  → EmbeddingProvider.embed()  # Generate vector embeddings
  → VectorStore.add()       # Store chunks + embeddings
```

```
User Query
  → EmbeddingProvider.embed()  # Embed the query
  → VectorStore.search()       # Find top-K similar chunks
  → build_rag_prompt()         # Combine context + query into chat messages
  → LLMClient.complete()       # Generate answer
  → RAGResult                  # Answer + sources + metadata
```

## Components

### Chunking (`app/rag/chunking.py`)
- Splits text by character count with configurable overlap
- Produces `Chunk` objects with source and index metadata

### Embeddings (`app/rag/embeddings.py`)
- **EmbeddingProvider** ABC with `embed()` and `dimensions` methods
- **LocalHashEmbedding** — deterministic hash-based placeholder for dev (no API keys needed)
- **OpenAIEmbedding** — real embeddings via `text-embedding-3-small`
- Factory: `create_embedding_provider()` reads `EMBEDDING_PROVIDER` from config

### Vector Store (`app/rag/vector_store.py`)
- **VectorStore** ABC with `add()`, `search()`, `clear()`, `count()` methods
- **InMemoryVectorStore** — cosine similarity with numpy, suitable for dev/small docs
- Factory: `create_vector_store()` (only `memory` type for now)

### Ingestion (`app/rag/ingestion.py`)
- `load_documents(path)` — reads `.txt` and `.md` files from a directory
- `ingest_documents()` — orchestrates chunk → embed → store

### Retrieval (`app/rag/retrieval.py`)
- `retrieve()` — embeds query, searches vector store, returns `SearchResult` list

### LLM Client (`app/llm/client.py`)
- **LLMClient** ABC with `complete(messages)` method
- **OpenAIClient** — chat completions via `gpt-4o-mini`
- **EchoClient** — placeholder that returns query text (no API calls)
- Factory: `create_llm_client()` reads `LLM_PROVIDER` from config

### RAG Service (`app/services/rag_service.py`)
- `rag_query()` — orchestrates retrieve → prompt → LLM → `RAGResult`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/rag/query` | Query the RAG pipeline |
| POST | `/api/v1/rag/ingest` | Ingest documents from configured path |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `""` | `"openai"` or empty (uses EchoClient) |
| `OPENAI_API_KEY` | `""` | Required when LLM_PROVIDER=openai |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model for completions |
| `EMBEDDING_PROVIDER` | `""` | `"openai"` or empty (uses LocalHashEmbedding) |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI embedding model |
| `EMBEDDING_DIMENSIONS` | `256` | Embedding vector dimensions |
| `VECTOR_STORE_TYPE` | `memory` | Only `memory` supported currently |
| `RAG_TOP_K` | `3` | Number of chunks to retrieve |
| `RAG_CHUNK_SIZE` | `500` | Characters per chunk |
| `RAG_CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `RAG_DOCUMENTS_PATH` | `data/documents` | Directory for source documents |

## Local Development

Without any API keys configured, the pipeline uses:
- **LocalHashEmbedding** — hash-based vectors (no semantic similarity)
- **EchoClient** — echoes query back (no LLM calls)
- **InMemoryVectorStore** — in-process storage

This allows testing the full pipeline architecture without external dependencies.

## Future Enhancements

- PostgreSQL + pgvector for persistent vector storage
- Anthropic Claude as an LLM provider option
- PDF and HTML document loaders
- Hybrid search (BM25 + vector similarity)
- Streaming responses
