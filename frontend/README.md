# frontend

React frontend application for the LIRA library system. This area owns the browser experience for library members, administrators, and other authenticated users.

The source tree separates route-level pages, reusable components, API-facing services, hooks, and client state. Static files that do not require compilation belong in `public/`.

## Responsibilities

- Present catalog search, availability, loans, chatbot, administration, and reporting workflows.
- Manage navigation, session-aware UI, loading states, validation, and user-facing errors.
- Call backend APIs through the wrappers in `src/services/` rather than embedding request logic in visual components.

## Supabase account setup

1. Create a Supabase project and open **SQL Editor**.
2. Run `supabase/migrations/202609260001_student_library_data.sql` from the repository root. If the first migration was already applied, also run `supabase/migrations/202609260002_rename_course_to_school.sql`, `supabase/migrations/202609260003_split_student_name.sql`, and `supabase/migrations/202609260004_reservations.sql`.
3. Copy `frontend/.env.example` to `frontend/.env` and fill in the project URL and anon key from **Project Settings > API**.
4. Start the frontend with `npm run dev` from `frontend/` and open `/catalog`.

Supabase Auth handles passwords and sessions. The database trigger creates a profile using the student's name and school collected during sign-up. Row Level Security limits profiles, reading history, and bookmarks to their owning student. Never expose the service-role key in Vite or browser code.

To disable email verification, open the Supabase dashboard and go to **Authentication > Providers > Email**, turn off **Confirm email**, and save. This setting cannot be changed securely from frontend code.
