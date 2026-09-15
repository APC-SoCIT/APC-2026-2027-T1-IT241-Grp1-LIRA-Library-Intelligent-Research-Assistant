# src

Frontend source code for LIRA components, pages, services, hooks, and state management. This is the main implementation boundary for the React application.

Feature UI belongs in `components/`, full route views belong in `pages/`, and cross-cutting client behavior belongs in `hooks/` or `store/`. Network access should remain behind `services/` so components stay focused on rendering and interaction.
