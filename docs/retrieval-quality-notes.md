# Retrieval Quality Notes

Observations and design decisions about RAG retrieval quality.

---

## Current State

### Embedding Provider
- **Default**: `LocalHashEmbedding` — deterministic hash-based vectors
- **Production**: `OpenAIEmbedding` — real semantic embeddings (set `EMBEDDING_PROVIDER=openai`)

With `LocalHashEmbedding`, retrieval quality is keyword-matching level. Two texts with similar words will have similar hashes, but there is no semantic understanding. "Cheapest shipping option" and "most affordable carrier" may not match well.

With `OpenAIEmbedding`, retrieval becomes truly semantic. Similar meanings match even with different wording.

### Chunk Size
- **Current**: 500 characters with 50-character overlap
- **Rationale**: 500 chars is roughly 80-100 words — enough to carry a coherent paragraph or a few bullet points, but small enough that irrelevant content in the same chunk is minimized.
- **Tradeoff**: Smaller chunks (200-300 chars) would be more precise but may lack context. Larger chunks (1000+ chars) carry more context but include more noise.

### Top-K
- **Current**: 3 (configurable via `RAG_TOP_K`)
- **Rationale**: With 14 documents producing ~150 chunks, top-3 retrieves enough context without overwhelming the LLM prompt.
- **When to increase**: If the corpus grows to 50+ documents, consider increasing to 5 for broader coverage.

## What Changed with Expansion

### Before (2 documents, ~8 chunks)
- Retrieval had very few chunks to choose from
- Most queries returned the same few chunks regardless of question
- Source diversity was minimal (only 2 possible sources)

### After (14 documents, ~150+ chunks)
- Retrieval has a much larger pool of chunks
- Queries about specific topics (DHL, fragile items, delays) now have dedicated content to retrieve
- Sources span multiple categories, giving the advisor richer context
- Different questions retrieve different chunks — retrieval is more discriminating

## Quality Observations

### Works Well
- Carrier-specific questions ("What does UPS Ground offer?") retrieve from the correct carrier doc
- General comparison questions retrieve from the comparison doc
- Scenario-based questions ("package is delayed") retrieve from the delays doc

### Limitations
- With `LocalHashEmbedding`, synonym-based queries may miss relevant content
- No metadata filtering — a question about "UPS" may retrieve chunks from the general FAQ that mention UPS casually, rather than the dedicated UPS overview
- Chunk boundaries sometimes split tables or lists mid-row, which can produce partial/confusing chunks

## Tuning Recommendations

### If retrieval quality is poor after enabling OpenAI embeddings:

1. **Check chunk size**: If relevant content is being split across chunks, increase `RAG_CHUNK_SIZE` to 800
2. **Check top-K**: If the answer requires information from multiple chunks, increase `RAG_TOP_K` to 5
3. **Check content quality**: Is the answer actually in the knowledge base? Add content if not
4. **Check query phrasing**: Rephrase the query to match the content's language

### If the corpus grows large (50+ documents):
1. Increase `RAG_TOP_K` to 5-7
2. Consider a persistent vector store (avoid re-ingesting on every restart)
3. Consider adding metadata-based filtering (by category, carrier, etc.)
4. Monitor chunk count — very large corpora may need different chunking strategies

## Interview Talking Points

The RAG pipeline is designed for explainability:

1. **Ingestion**: Documents are loaded from disk, chunked into overlapping segments, embedded, and stored. Each step is a separate module with a clear interface.

2. **Retrieval**: The user's query is embedded with the same provider, then searched against stored chunks using cosine similarity. Top-K results are returned with scores and source metadata.

3. **Augmented generation**: Retrieved chunks are injected into the LLM prompt as context. The LLM generates an answer grounded in the retrieved content.

4. **Source traceability**: Every answer includes the source documents and chunk indices that informed it. This is critical for trust and debugging.

5. **Provider abstraction**: The embedding provider, vector store, and LLM client are all behind ABCs. Swapping from hash-based to OpenAI embeddings is a config change, not a code change.

6. **Content organization**: Documents are organized by purpose (carriers, guides, scenarios, policies). This makes the knowledge base maintainable and the retrieval results interpretable.
