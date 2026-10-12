# LIRA Koha Reading Lists plugin

This plugin adds a private reading list API to Koha. LIRA's catalog service calls it using the existing `lira_api` Koha staff account. Students and librarians authenticate to LIRA; the backend resolves each signed-in user's Koha patron ID and only exposes lists owned by that patron.

## Routes

The plugin registers routes under `/api/v1/contrib/lira-lists`:

- `GET/POST /patrons/{patron_id}/lists`
- `PUT/DELETE /patrons/{patron_id}/lists/{list_id}`
- `GET /patrons/{patron_id}/lists/{list_id}/items`
- `GET /patrons/{patron_id}/bookmarks`
- `PUT/DELETE /patrons/{patron_id}/lists/{list_id}/items/{biblio_id}`
- `PUT /patrons/{patron_id}/bookmarks/{biblio_id}`

All shelves created by the plugin are private. The controller checks shelf ownership before every read or write. Koha's API permission declaration requires `borrowers: edit_borrowers` for the `lira_api` staff account.

## Build the KPZ package

From the repository root, run:

```powershell
& .\integrations\koha-reading-lists\build-plugin.ps1
```

A KPZ is a ZIP archive. The archive must contain `Koha/Plugin/Com/Lira/ReadingLists.pm` at its root.

## Install in Koha

1. In the Koha staff interface, open **More → Administration → Plugins**.
2. Upload `LiraReadingLists-1.0.1.kpz` to update the installed plugin. Then use **Actions → Enable** for **LIRA Reading Lists API**.
3. Ask your Koha administrator to confirm plugins are enabled in `koha-conf.xml` (`<enable_plugins>1</enable_plugins>`). If uploading through the staff interface is restricted, they may need to review the `plugins_restricted` setting.
4. Restart or reload Koha Plack so Koha registers the plugin's API routes. For a self-managed server, the system administrator can run `sudo koha-plack --restart <instance-name>`. For hosted Koha, ask the hosting provider to restart/reload Plack. Koha may also require the plugin to be reinstalled after the restart.
5. Confirm `lira_api` has `borrowers → Add, modify and view patron information (edit_borrowers)` enabled.
6. Open `https://YOUR-KOHA-HOST/api/v1/.html` and search the API documentation for `lira-lists`. If it is listed, the route was registered. Then check `https://YOUR-KOHA-HOST/api/v1/contrib/lira-lists/patrons/1/lists` from the LIRA backend network. A `401` means the route is loaded but credentials were not accepted; a `403` means the account lacks the required permission; a `404` suggests the plugin route is not loaded or patron `1` does not exist.

The route uses the Koha patron's internal numeric `borrowernumber`, not the card number. LIRA reads that ID from the signed-in user's profile and provisions it if the profile does not have one.

## LIRA migration and deployment

Before deploying the backend, run `supabase/migrations/202610130002_koha_lists_migration_marker.sql` in the Supabase SQL editor. This adds a marker so LIRA can transfer each user's existing Supabase lists and bookmarks once, on their next list request. The backend needs its existing Supabase service-role configuration for this one-time transfer.

After every existing list and bookmark has transferred successfully, run `supabase/migrations/202610130003_drop_legacy_reading_lists.sql` to remove the old Supabase tables. This migration checks for untransferred rows and stops with an error if any remain. The backend treats both old tables being absent as an empty legacy store for accounts created afterward.

Deploy the updated `backend/catalog-service` and `frontend` after the plugin is installed. Keep `KOHA_BASE_URL`, `KOHA_API_USERNAME`, and `KOHA_API_PASSWORD` configured in the catalog service. The Koha API credentials stay on the backend and must not be placed in frontend environment variables.

The plugin targets Koha 18.11 or newer, but validate it against your exact Koha release in a staging instance before enabling it for patrons.
