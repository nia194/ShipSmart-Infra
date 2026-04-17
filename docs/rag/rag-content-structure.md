# RAG Content Structure

Layout and purpose of the knowledge base documents.

---

## Directory Layout

```
apps/api-python/data/documents/
│
├── carriers/                         # Per-carrier overviews
│   ├── carrier-info.txt              # Original seed: brief carrier descriptions
│   ├── ups-overview.md               # UPS services, pricing, strengths, issues
│   ├── fedex-overview.md             # FedEx services, pricing, strengths, issues
│   ├── dhl-overview.md               # DHL Express services, international focus
│   └── usps-overview.md              # USPS services, flat-rate, residential advantage
│
├── guides/                           # How-to and decision guides
│   ├── shipping-faq.md               # Original seed: general shipping FAQ
│   ├── ground-vs-express.md          # Speed/cost tradeoffs by service tier
│   ├── packaging-best-practices.md   # Fragile, heavy, oversized, DIM weight
│   └── address-quality.md            # Address validation, residential/commercial, failed delivery
│
├── scenarios/                        # Real-world shipping scenarios
│   ├── recommendation-tradeoffs.md   # Cost/speed/reliability/value framework
│   └── delays-and-exceptions.md      # Delay types, what to do, carrier contacts
│
└── policies/                         # Carrier policies and comparisons
    ├── carrier-comparison.md         # Side-by-side tables (services, limits, DIM, insurance)
    ├── returns-and-claims.md         # Claims process, lost packages, return shipping
    └── international-shipping-basics.md  # Customs, duties, HS codes, restrictions
```

## Document Count

| Category | Documents | Focus |
|----------|-----------|-------|
| carriers/ | 5 | Per-carrier details and service levels |
| guides/ | 4 | Decision frameworks and how-to content |
| scenarios/ | 2 | Real-world tradeoffs and exception handling |
| policies/ | 3 | Comparisons, claims, international rules |
| **Total** | **14** | |

## Category Purposes

### carriers/
One document per carrier with consistent structure: service levels, pricing factors, address validation capabilities, strengths, and limitations. Useful when users ask about a specific carrier.

### guides/
Decision-making content that helps users choose between options. Covers the most common questions: which shipping speed, how to package, and why addresses matter. Useful for the advisor's general guidance.

### scenarios/
Real-world situations with specific recommendations. Matches how users actually think about shipping: "I need to send a gift by Friday" rather than "compare 2-day services." Useful for the recommendation engine and advisor.

### policies/
Reference material for carrier policies, side-by-side comparisons, claims procedures, and international rules. Useful when users need specific policy details.

## Ingestion Flow

```
Startup / POST /api/v1/rag/ingest
  │
  ├─ load_documents("data/documents")
  │   └─ Recursively globs **/*.txt and **/*.md
  │   └─ Returns list of (relative_path, content) tuples
  │
  ├─ chunk_text() per document
  │   └─ 500-char chunks with 50-char overlap
  │   └─ Source = relative path (e.g. "carriers/ups-overview.md")
  │
  ├─ embedding_provider.embed() on all chunks
  │
  └─ vector_store.add() to store chunks + embeddings
```

## Source Metadata in Retrieval

When chunks are retrieved, the `source` field contains the relative path:
```json
{
  "source": "carriers/ups-overview.md",
  "chunk_index": 3,
  "score": 0.847
}
```

This allows the frontend or LLM to reference where information came from, organized by category.
