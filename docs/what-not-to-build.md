# What NOT to Build

Items explicitly out of scope. Do not implement these.

---

## Out of Scope

| Item | Why Not |
|------|---------|
| **CI/CD pipeline** | Does not demonstrate backend/AI skills. Render auto-deploys on push to main. |
| **Monitoring / observability platforms** | Operational concern, not interview-relevant architecture. Render dashboard is sufficient. |
| **Advanced observability** (Datadog, Grafana, log drains) | Same as above. Not a design pattern worth discussing. |
| **Analytics** (user tracking, event logging, dashboards) | Product concern, not engineering depth. |
| **Scaling infrastructure** (load balancers, auto-scaling, k8s) | Premature. No traffic to scale for. Not a design discussion point. |
| **A/B testing** | Product experimentation concern, not architecture. |
| **Unrelated UI redesign** | Frontend is functional. UI polish does not add interview value. |
| **Extra feature work not tied to interviews** | Multi-turn conversations, persistent vector store, and other "nice-to-haves" are deferred. Only build what strengthens talking points around provider integration, RAG, and LLM design. |
| **Java-to-Python service calls** | No use case. Frontend orchestration works. |
| **ShipmentController implementation** | No UI consumes it. Prioritize user-facing features. |
| **Decommission Supabase edge functions** | Cleanup work, not interview value. Keep feature flags as-is. |

---

## Rule

Before building anything, ask: "Can I explain this in an interview as a design decision about provider integration, backend architecture, RAG retrieval, or LLM abstraction?"

If the answer is no, do not build it.
