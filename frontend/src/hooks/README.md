# Hooks

Custom React hooks used across the frontend. Hooks encapsulate reusable client behavior such as session access, data loading, debounced catalog search, chatbot interaction, and responsive UI state.

Hooks should expose a small, predictable interface and handle cleanup for subscriptions or in-flight work where necessary. They should not duplicate API contract logic that belongs in `services/`.
