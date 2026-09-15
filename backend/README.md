# backend

Node/Express backend services that provide LIRA's library, AI, administration, and analytics capabilities. Each service owns a focused domain and communicates through explicit APIs or shared integration adapters.

## Service Boundaries

- `auth-service/` owns identity and session-related interactions.
- `catalog-service/` and `loans-service/` own library inventory and circulation workflows.
- `ai-service/` groups the assistant's user-facing capabilities.
- Configuration and reporting are isolated in `chatbot-config-service/` and `analytics-service/`.

Cross-cutting middleware, guards, and logging belong in `shared/`. Services should keep secrets and environment-specific settings outside source control.
