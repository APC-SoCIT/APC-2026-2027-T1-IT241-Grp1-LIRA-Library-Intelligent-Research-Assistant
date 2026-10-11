System architecture diagrams and supporting notes. Documents here should explain service boundaries, request and data flows, external dependencies, authentication paths, deployment relationships, and important tradeoffs.

Diagrams should be kept consistent with the repository structure and updated when a service contract or integration boundary changes. Architecture notes should include the date and status of significant decisions where useful.

## Repository Hierarchy

```mermaid
flowchart TD
	Root["LIRA"]

	Root --> Frontend["frontend/"]
	Frontend --> FrontendSrc["src/"]
	FrontendSrc --> App["App.jsx"]
	FrontendSrc --> Pages["pages/"]
	Pages --> Home["HomePage.jsx"]
	Pages --> Opac["OpacPage.jsx"]
	FrontendSrc --> Components["components/"]
	Components --> FeatureComponents["Feature sections and shared UI"]
	Components --> ComponentAreas["admin/ · auth/ · catalog/ · chatbot/ · loans/ · shared/"]
	FrontendSrc --> Data["data/mockBooks.js"]
	FrontendSrc --> Services["services/"]
	FrontendSrc --> Store["store/"]
	FrontendSrc --> Hooks["hooks/"]
	Frontend --> FrontendConfig["package.json · Vite/Tailwind config"]

	Root --> Backend["backend/"]
	Backend --> Auth["auth-service/"]
	Backend --> Catalog["catalog-service/"]
	Backend --> Loans["loans-service/"]
	Backend --> AI["ai-service/"]
	AI --> Citations["citations/"]
	AI --> FAQ["faq/"]
	AI --> Recommendations["recommendations/"]
	AI --> Summaries["summaries/"]
	AI --> RAG["rag/"]
	RAG --> Ingestion["ingestion/"]
	RAG --> Embeddings["embeddings/"]
	RAG --> Retrieval["retrieval/"]
	RAG --> Prompts["prompts/"]
	Backend --> Analytics["analytics-service/"]
	Backend --> ChatbotConfig["chatbot-config-service/"]
	Backend --> BackendShared["shared/"]

	Root --> Integrations["integrations/"]
	Integrations --> Koha["koha-ils/"]
	Koha --> KohaAPI["api/ · client/ · schemas/"]
	Integrations --> Gutendex["gutendex/"]
	Gutendex --> GutendexAreas["client/ · schemas/ · mapper/ · marc/ · scripts/"]

	Root --> DataRoot["data/"]
	DataRoot --> Raw["raw/"]
	DataRoot --> Processed["processed/"]
	DataRoot --> MARC["marc/"]

	Root --> Infra["infra/"]
	Infra --> InfraAreas["docker/ · koha/ · environment/"]
	Root --> Docs["docs/"]
	Docs --> Architecture["architecture/"]
	Docs --> API["api/"]
	Docs --> Setup["setup/"]
	Docs --> DataPipeline["data-pipeline/"]
	Docs --> Backlog["sprint-backlog/"]

	Frontend -. "API requests" .-> Backend
	Backend -. "library system data" .-> Koha
```

The frontend is the user-facing application, backend folders represent independently owned service boundaries, and the integration layer makes external systems explicit. Koha remains the catalog source of truth and is accessed through its REST API. Gutendex is the external Gutenberg metadata source for the future Gutendex-to-MARC21-to-Koha pipeline. The AI/RAG layer will consume catalog information through the backend/API. `frontend/src/data/mockBooks.js` is temporary mock/test data, not the authoritative catalog.
