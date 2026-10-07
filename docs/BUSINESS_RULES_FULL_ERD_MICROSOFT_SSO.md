# LIRA Full ERD Business Rules — Microsoft SSO

## Purpose

These rules describe what the LIRA system must allow, prevent, or preserve when using Microsoft Entra ID as the identity provider. They are based on the [Full ERD with AI Services and Koha](MSYADD1/diagrams/LIRA_Full_System_ERD_With_AI_Koha(Version1).puml) and the [Microsoft SSO ERD schema](MSYADD1/diagrams/LIRA_Full_ERD_Supabase_Microsoft_SSO.sql).

The rules are written in simple terms for requirements review, system presentation, and future implementation. Rules marked **Proposed** describe parts of the full ERD that are not yet fully implemented in the current migrations or services.

## Rule status

- **Current** — supported by the current database migrations or application code.
- **Target** — required by the Microsoft SSO full ERD design.
- **Proposed** — shown in the full ERD but still needs its production migration, service, or integration.

## 1. Identity and Microsoft SSO rules

| ID | Business rule | Status |
|---|---|---|
| IAM-01 | Every user must authenticate through the approved APC Microsoft Entra ID tenant before accessing protected LIRA features. | Target |
| IAM-02 | LIRA must identify an account by Microsoft Entra `object_id`, not by display name. Names can change; the object ID is the stable identity reference. | Target |
| IAM-03 | Each Microsoft account may have only one LIRA profile. | Target; enforced by the unique profile-to-Microsoft-account constraint in the target SQL. |
| IAM-04 | Each Microsoft account email must be unique in LIRA. | Target; enforced in the target SQL. |
| IAM-05 | The `tenant_id` must be checked so an account from an unapproved Microsoft tenant cannot create a LIRA profile. | Target |
| IAM-06 | On first successful sign-in, LIRA must provision one local profile linked to the Microsoft account. | Target |
| IAM-07 | On later sign-ins, LIRA must update the existing account's last-login information and refresh allowed profile attributes without creating a duplicate profile. | Target |
| IAM-08 | A profile cannot be deleted while its Microsoft account is still referenced. The account relationship must be removed or deactivated through an approved account-management process. | Target; the target SQL uses restricted deletion. |
| IAM-09 | Authentication data comes from Microsoft Entra ID; library activity and LIRA-specific information are stored in LIRA/Supabase. | Target |
| IAM-10 | The user's role must be one of `student`, `librarian`, or `administrator`. | Target; the target SQL uses an enum. |
| IAM-11 | A new account defaults to the `student` role. Librarian and administrator access must be granted through an authorized administrative process. | Target |
| IAM-12 | A user must not be able to change their own role through ordinary profile editing. | Target |

## 2. Profile and privacy rules

| ID | Business rule | Status |
|---|---|---|
| PROF-01 | Each profile belongs to exactly one authenticated user. | Current/Target |
| PROF-02 | A profile may store the user's name, school, and role, but only permitted profile fields should be editable by the user. | Current/Target |
| PROF-03 | A user may view and update only their own profile details. | Current; enforced by current Supabase RLS policies. |
| PROF-04 | A user's reading history, search history, book views, reading lists, bookmarks, reservations, chat sessions, AI requests, and recommendations must be isolated from other users. | Current for implemented tables; Target/Proposed for future tables. |
| PROF-05 | Deleting a profile should delete user-owned activity that has no institutional retention requirement. | Target; most target relationships use cascade deletion. |
| PROF-06 | Audit records should remain available when a user is removed if accountability or legal retention requires them. The user reference may become null. | Target; the target SQL uses `ON DELETE SET NULL` for audit events. |
| PROF-07 | Personal data must not be exposed through public or anonymous database access. | Target |

## 3. Koha catalog and circulation rules

| ID | Business rule | Status |
|---|---|---|
| KOH-01 | Koha is the authoritative source for bibliographic records, physical items, availability, and circulation. | Current/Target |
| KOH-02 | LIRA must reference Koha records using stable identifiers such as `biblio_id`, `item_id`, and Koha loan IDs. | Current/Target |
| KOH-03 | LIRA must not silently overwrite the authoritative title, author, item, availability, or loan status held by Koha. | Target |
| KOH-04 | One Koha bibliographic record may have many Koha items. | Target; represented in the full ERD. |
| KOH-05 | One Koha item may have many historical loan records, but an item should not have conflicting active loans at the same time. | Target |
| KOH-06 | If Koha is unavailable, LIRA should show a clear temporary-unavailable message and must not present stale availability as confirmed current availability. | Current/Target |
| KOH-07 | A Koha record must have a valid numeric identifier before it is returned as a LIRA book. | Current; enforced by catalog normalization. |
| KOH-08 | External Koha relationships shown with dotted ERD lines are logical references, not local foreign keys. | Target |
| KOH-09 | Koha catalog changes must be reflected in the LIRA catalog through normal reads or a controlled synchronization/indexing process. | Target |

## 4. Catalog search and semantic-search rules

| ID | Business rule | Status |
|---|---|---|
| CAT-01 | Users may search using keyword, semantic, or hybrid search modes. | Current |
| CAT-02 | Keyword search should search the supported Koha fields, currently title, author, and ISBN. | Current |
| CAT-03 | Semantic search must compare the user's query embedding with catalog embeddings and return the closest matching books. | Current |
| CAT-04 | Hybrid search should combine keyword and semantic results and rank records appearing in both result sets more strongly. | Current |
| CAT-05 | Every semantic-search result must use the common LIRA `Book` format before being sent to the frontend. | Current |
| CAT-06 | A catalog embedding must represent one book identified by `book_id`. The current index should contain at most one current embedding per book. | Current/Target |
| CAT-07 | The embedding model and vector dimension used for queries must match the dimension stored in `catalog_embeddings`. | Current/Target |
| CAT-08 | The current OpenRouter configuration expects 1,536-dimensional embeddings. | Current |
| CAT-09 | A semantic catalog reindex must be protected by an indexing key and must not be available to ordinary users. | Current |
| CAT-10 | Reindexing must process the current Koha catalog, replace or update current embeddings, and remove stale embeddings from books no longer present. | Current |
| CAT-11 | If the semantic provider or vector store is unavailable, the service must return a controlled service-unavailable error rather than fabricated results. | Current |
| CAT-12 | Search-result caches may improve performance, but cached results must expire and must be cleared after a full semantic reindex. | Current |
| CAT-13 | Catalog embeddings should not be readable by anonymous or ordinary client roles; privileged backend access should be used. | Current/Target |

## 5. Reading lists, bookmarks, history, and reservations

| ID | Business rule | Status |
|---|---|---|
| LIB-01 | A user may create multiple named reading lists. | Current |
| LIB-02 | A reading-list name must be 1–60 characters after trimming whitespace. | Current/Target |
| LIB-03 | Reading-list names must be unique for the same user, but different users may use the same name. | Current/Target |
| LIB-04 | A bookmark must belong to the same user who owns its reading list. | Current; enforced by the composite user/list relationship in the target SQL and by user-scoped queries in the current service. |
| LIB-05 | A user may save a book only once across their bookmarks. Saving the same book again should update or preserve the existing bookmark instead of creating a duplicate. | Current |
| LIB-06 | A user may move a bookmark between their own reading lists. | Current |
| LIB-07 | Deleting a reading list must not silently delete bookmarks unless that behavior is explicitly selected as a product rule. | Target; the target SQL uses restricted deletion. |
| LIB-08 | A user may have only one current reading-history row per book. Reading the book again updates `last_read_at`. | Current |
| LIB-09 | Search history records only a non-empty, trimmed query and should be limited to 200 characters. | Current |
| LIB-10 | A user's latest book view should be upserted by user and book, so repeated views update the timestamp rather than creating unlimited duplicates. | Current |
| LIB-11 | A user may place a book in their reservation list only once at a time. | Current |
| LIB-12 | A reservation-cart record is not proof that Koha has completed a physical reservation or checkout. It must be confirmed through a circulation workflow. | Current/Target |
| LIB-13 | Removing a user should remove their personal reading lists, bookmarks, history, views, searches, and reservations unless retention rules require otherwise. | Current/Target |

## 6. Local loan and overdue rules

| ID | Business rule | Status |
|---|---|---|
| LOAN-01 | A local loan transaction must belong to one LIRA profile and should reference the related Koha book/item where available. | Proposed |
| LOAN-02 | A local transaction must use one of: `reserved`, `checked_out`, `returned`, `overdue`, or `cancelled`. | Proposed; represented by the target SQL enum. |
| LOAN-03 | A returned transaction must have a return time, and an active checked-out transaction should have a due date. | Proposed |
| LOAN-04 | A loan becomes overdue when its due date has passed and it has not been returned or cancelled. | Proposed |
| LOAN-05 | An overdue alert must belong to one loan transaction. | Proposed |
| LOAN-06 | An alert may be `pending`, `sent`, `failed`, or `dismissed`; sending must record `sent_at` when successful. | Proposed |
| LOAN-07 | LIRA loan status must not contradict Koha's authoritative circulation status after synchronization. | Proposed |

## 7. Chatbot and knowledge-base rules

| ID | Business rule | Status |
|---|---|---|
| AI-01 | Only one chatbot configuration should be active for normal user conversations at a time. | Proposed |
| AI-02 | Every chatbot configuration must have a unique version number. | Proposed; enforced in the target SQL. |
| AI-03 | A chatbot session belongs to one user and may record which chatbot configuration was used. | Proposed |
| AI-04 | A chat session may contain many messages, ordered by creation time. | Proposed |
| AI-05 | A message role must be `user`, `assistant`, or `system`. | Proposed; represented by the target SQL enum. |
| AI-06 | Knowledge sources must identify their type as FAQ, policy, catalog, document, or URL. | Proposed |
| AI-07 | A source may be divided into many ordered knowledge chunks. Deleting a source should delete its chunks. | Proposed |
| AI-08 | Only active or approved knowledge sources should be used to answer ordinary users. Draft, archived, or failed sources must be excluded. | Proposed |
| AI-09 | A chatbot response should retain links to the knowledge chunks or book records that supported it whenever retrieval was used. | Proposed |
| AI-10 | AI-generated answers must not be treated as authoritative for account permissions, circulation status, or official library policy unless the answer is grounded in an approved source. | Proposed |
| AI-11 | Chatbot prompts, provider credentials, and service-role keys must not be exposed to browser clients. | Target |

## 8. AI summaries and citations

| ID | Business rule | Status |
|---|---|---|
| OUT-01 | A summary request belongs to one user and one book. | Proposed |
| OUT-02 | Summary length must be `short`, `medium`, or `long`. | Proposed; represented by the target SQL enum. |
| OUT-03 | A summary request must move through a controlled state such as queued, processing, completed, or failed. | Proposed |
| OUT-04 | A completed summary must belong to one request, and one request must not create multiple current summaries. | Proposed; enforced by the target one-to-one unique key. |
| OUT-05 | A citation request belongs to one user and one book and must use an approved citation style, currently APA or MLA. | Proposed |
| OUT-06 | A completed citation must preserve missing-field information rather than inventing unavailable bibliographic data. | Proposed |
| OUT-07 | AI outputs should preserve source context or source metadata so users can understand what information was used. | Proposed |
| OUT-08 | Failed requests should retain the failure state and not be presented as completed outputs. | Proposed |

## 9. Recommendations

| ID | Business rule | Status |
|---|---|---|
| REC-01 | Each recommendation calculation belongs to one user and records the strategy used. | Proposed |
| REC-02 | A recommendation run may contain many books, but the same book may appear only once in a single run. | Proposed; enforced by the target unique key. |
| REC-03 | Each recommendation item should preserve its rank, score, and a human-readable reason when available. | Proposed |
| REC-04 | Recommendations may use search history, book views, reading history, school, and semantic similarity, but users must not see another user's private activity. | Current/Proposed |
| REC-05 | A recommendation should not be presented as a confirmed availability or reservation. Availability must be checked against Koha. | Proposed |

## 10. Reports and audit rules

| ID | Business rule | Status |
|---|---|---|
| REP-01 | Only authorized staff may create report requests. | Proposed |
| REP-02 | A report request must identify its staff requester, report type, date range, filters, and processing status. | Proposed |
| REP-03 | A report may produce PDF or CSV exports only. | Proposed; represented by the target SQL enum. |
| REP-04 | A report export belongs to one report request and should not exist without that request. | Proposed |
| REP-05 | Audit events should record the actor, action, entity type, entity ID where available, details, and event time. | Proposed |
| REP-06 | Audit records must not contain secrets such as passwords, OAuth client secrets, service-role keys, or access tokens. | Target |
| REP-07 | Staff reports must apply role and privacy restrictions before exposing user activity or circulation information. | Proposed |

## 11. Data integrity and lifecycle rules

| ID | Business rule | Status |
|---|---|---|
| DATA-01 | IDs used to connect LIRA data to Koha must remain stable references and must not be reused for a different book or item. | Target |
| DATA-02 | User-owned rows must not be accepted with a `user_id` different from the authenticated user's ID. | Current for existing Supabase RLS-protected tables. |
| DATA-03 | Unique constraints must prevent duplicate identity links, reading-list names per user, bookmarks per user/book, history per user/book, reservations per user/book, and recommendation items per run/book. | Current/Target |
| DATA-04 | Child records should be deleted when their parent is intentionally deleted, except where retention or audit rules require preservation. | Target |
| DATA-05 | External references to Koha and OpenRouter must be treated as unavailable when their services cannot be reached; the system must not fabricate successful data. | Current/Target |
| DATA-06 | Database schema changes involving embedding dimensions must be applied in order, and the catalog must be reindexed after a dimension change. | Current |
| DATA-07 | Proposed ERD tables must not be described as implemented until their migrations, access policies, services, and tests exist. | Target |

## 12. Security rules for Microsoft SSO and Supabase

| ID | Business rule | Status |
|---|---|---|
| SEC-01 | The Microsoft OAuth callback must validate issuer, tenant, audience, signature, expiration, and required claims before provisioning a profile. | Target |
| SEC-02 | The browser may receive only a user-safe session; Microsoft client secrets and Supabase service-role keys must remain server-side. | Target |
| SEC-03 | Database row-level security must restrict personal data by the authenticated user identity. | Current/Target |
| SEC-04 | Administrative operations such as semantic reindexing, chatbot configuration, knowledge-source activation, and report access must require the appropriate role. | Target/Proposed |
| SEC-05 | All external API calls must use HTTPS and must apply timeouts and controlled error handling. | Current/Target |
| SEC-06 | Sensitive authentication and personal data must not be written to ordinary request logs. | Target |
| SEC-07 | When a Microsoft account is disabled or no longer belongs to the approved tenant, new access must be denied and the local profile must be handled according to the account-retention policy. | Target |

## 13. Key implementation gaps to track

1. The full ERD describes Microsoft Entra SSO, while the current frontend authentication code still uses Supabase email/password. The SSO rules above are target rules until the Entra adapter and provisioning flow are implemented.
2. Koha entities are external logical references, so synchronization rules are needed before local loan and overdue tables can be considered authoritative.
3. Chatbot, AI output, recommendation, report, and audit entities are marked proposed in the full ERD and need migrations, RLS policies, services, and tests.
4. The current semantic-search implementation expects 1,536-dimensional vectors. The matching database function and stored vectors must stay on the same dimension.

## 14. Business-rule summary

The central rule is: **Microsoft Entra ID proves who the user is, LIRA stores the user's application activity, Koha remains the authority for library records and circulation, and AI services may assist users but must not replace authoritative identity, catalog, availability, or policy data.**
