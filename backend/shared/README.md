Common middleware, authentication guards, and logging for backend services. This area provides cross-cutting behavior such as request correlation, authorization checks, error normalization, validation helpers, and consistent service logging.

Shared utilities should remain lightweight and stable. Domain-specific rules belong in the owning service so that this folder does not become an implicit shared application layer.
