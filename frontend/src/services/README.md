# Client Services

API client wrappers for authentication, chatbot, catalog, and loans. These modules define the frontend-facing request and response boundary for backend services, including serialization, error normalization, and authentication headers.

Components and pages should call these wrappers instead of constructing fetch requests directly. Service contracts should stay aligned with the corresponding backend service and integration documentation.
