# Known Limitations

Current limitations of the deployed ShipSmart system. These are understood tradeoffs, not bugs.

---

## Mock vs Real

| Component | Current | Production Path |
|-----------|---------|-----------------|
| Shipping provider | MockShippingProvider (synthetic data) | Integrate real carrier APIs (UPS, FedEx, DHL) |
| LLM | EchoClient (echoes RAG context) | Set `LLM_PROVIDER=openai` + `OPENAI_API_KEY` |
| Embeddings | LocalHashEmbedding (hash-based) | Set `EMBEDDING_PROVIDER=openai` for semantic search |
| Vector store | InMemoryVectorStore | Sufficient for current 2-doc corpus; upgrade if documents grow |
| Tool selection | Regex-based patterns | Upgrade to LLM-driven tool selection |

## Infrastructure

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| Render Starter plan cold starts | 15-30s delay after idle | Uptime monitor or paid plan |
| In-memory vector store | Data lost on restart | Re-ingested from files on startup (fast for 2 docs) |
| In-memory caches | Cleared on restart | TTLs keep data fresh; cache misses just mean slightly slower response |
| No CI/CD pipeline | Manual deploys via Render | Git push to main triggers auto-deploy on Render |
| No structured logging aggregation | Logs only in Render dashboard | Sufficient for launch; add log drain later |

## AI Quality

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| EchoClient gives raw context excerpts | Advisor answers feel like document dumps, not conversation | Enable OpenAI for real AI answers |
| LocalHashEmbedding has poor semantic understanding | RAG retrieval is keyword-matching quality, not semantic | Enable OpenAI embeddings |
| Only 2 seed documents | Limited knowledge base | Add more domain documents to `data/documents/` |
| No conversation history | Each advisor request is independent | Future: multi-turn conversation support |
| Tracking advisor `next_steps` empty with EchoClient | Step extraction expects numbered lists from LLM | Enable real LLM for structured output |

## Frontend

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| Recommendation panel depends on Python API | Hidden if Python is down | Graceful degradation — no error shown |
| Advisor page requires Python API | Shows error if Python is down | Clear error message; core quote flow unaffected |
| Relevance scores shown as percentages | Hash-based scores may be negative or > 100% | Cosmetic; switch to OpenAI embeddings for real scores |
| No client-side caching of advisor responses | Same question re-sent on each submission | Server-side cache handles repeat queries within TTL |

## Security

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| Python API has no authentication | All advisor endpoints are public | Advisory endpoints have no sensitive data; add auth if needed |
| Rate limiting not implemented | Potential for abuse | Add rate limiting in Phase 14+ or use Render's built-in limits |
| Swagger docs disabled in production | Cannot browse API in prod | By design; re-enable with `APP_ENV=development` for debugging |

---

## What Is NOT a Limitation

- **Feature flags for Java rollback** — This is a feature, not a limitation. Keep flags until Supabase edge functions are decommissioned.
- **Separate Java and Python services** — By design. Java owns transactions, Python owns AI. They don't need to talk to each other.
- **Mock provider in production** — Acceptable for launch. The recommendation engine works correctly with mock data. Real carrier integration is a future phase.
