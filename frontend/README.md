# frontend

React frontend application for the LIRA library system. This area owns the browser experience for library members, administrators, and other authenticated users.

The source tree separates route-level pages, reusable components, API-facing services, hooks, and client state. Static files that do not require compilation belong in `public/`.

## Responsibilities

- Present catalog search, availability, loans, chatbot, administration, and reporting workflows.
- Manage navigation, session-aware UI, loading states, validation, and user-facing errors.
- Call backend APIs through the wrappers in `src/services/` rather than embedding request logic in visual components.
