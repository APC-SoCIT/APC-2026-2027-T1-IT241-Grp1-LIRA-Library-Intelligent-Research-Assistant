<<<<<<< HEAD
# apc-mssyadd1-template
Template repository for APC MSSYADD1
=======
# LIRA

LIRA is an AI-powered library system built with a React frontend, Node/Express backend, and microservice-style architecture. It brings authentication, catalog discovery, borrowing workflows, conversational assistance, and operational reporting into one platform for library users and staff.

The repository is organized by deployable or independently owned areas. Each service folder can evolve behind a clear API boundary, while shared code and external integrations remain explicit rather than being duplicated across services.

## Project Areas

- [frontend](frontend/): React user interface and client-side application structure.
- [backend](backend/): Node/Express backend services for authentication, catalog, loans, AI, configuration, and analytics.
- [integrations](integrations/): External system integrations, including Koha ILS.
- [infra](infra/): Deployment, CI/CD, and environment configuration.
- [docs](docs/): Sprint backlog and architecture documentation.

## Development Scope

This repository currently contains a structure-only scaffold. Application code, service manifests, deployment files, and tests can be added within the documented ownership areas as the sprint work is implemented.
>>>>>>> 0cc7276 (Organize frontend and improve catalog browsing)
