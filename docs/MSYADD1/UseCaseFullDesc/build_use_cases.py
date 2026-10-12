from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


OUT = r"docs/MSYADD1/UseCaseFullDesc/LIRA_Fully_Dressed_Use_Case_Descriptions_Microsoft365.docx"

cases = [
{
"id":"UC-01", "title":"Sign In or Register with Microsoft 365 and Access LIRA", "status":"Target use case: Microsoft 365 organizational sign-in; current repository still uses Supabase email/password and requires implementation/configuration work",
"goal":"A Student/Faculty member or Librarian signs in to LIRA using their APC Microsoft 365 organizational account and reaches the features allowed for their provisioned role.",
"scope":"LIRA web application, Microsoft identity platform (Microsoft 365 organizational account), authentication callback/session handling, and Supabase profile/role lookup", "level":"User goal", "primary":"Student/Faculty or Librarian",
"secondary":"Microsoft identity platform; LIRA authentication callback/session layer; Supabase profile store for LIRA role lookup", "stakeholders":"End users want secure, reliable access using their institutional account. Librarians need catalog-management access restricted to provisioned librarian accounts. The institution needs organizational access controls and protected role data.",
"trigger":"The person chooses Continue with Microsoft 365 on the LIRA sign-in page, including when accessing LIRA for the first time.",
"pre":"LIRA is registered/configured with the institutional Microsoft identity provider and approved redirect URIs. The person has an eligible APC Microsoft 365 account and a supported browser. First-time account creation/provisioning rules and role assignment are configured.",
"success":"Microsoft 365 authenticates the person and LIRA establishes an application session. On first eligible sign-in, the LIRA account/profile is created or linked according to provisioning rules. LIRA resolves the person's role and exposes only authorized features.",
"minimal":"No unauthorized protected operation is performed. The person receives a usable error or is directed to sign in.",
"main":[("Actor","System"),("1. The person opens LIRA and selects Continue with Microsoft 365.","1.1 LIRA starts the configured organizational sign-in flow and sends the browser to the Microsoft identity platform with the registered client, redirect, and requested scopes."),("2. The person selects or enters their APC Microsoft 365 organizational account.","2.1 Microsoft authenticates the account and applies institutional controls such as MFA or conditional access when configured."),("3. On first use, the person authorizes the requested access or accepts the institution's sign-in terms, if required.","3.1 Microsoft returns the browser to LIRA's registered callback with the authentication result."),("4. The person returns to LIRA.","4.1 LIRA validates the callback and establishes or refreshes the application session using the approved identity-provider flow."),("5. The person is using LIRA for the first time.","5.1 LIRA creates or links the account/profile according to the agreed provisioning policy; it does not let the user self-assign a privileged librarian role."),("6. The person opens catalog features.","6.1 LIRA loads the profile role where needed and exposes librarian catalog management only when the stored role is librarian."),("7. A librarian submits a catalog write operation.","7.1 The catalog service validates the session token and checks the librarian role before invoking the write." )],
"extensions":["1a. Microsoft sign-in configuration is unavailable or the redirect URI is invalid: LIRA displays a sign-in error and does not establish a session.","2a. The account is not an eligible APC Microsoft 365 organizational account or institutional access is denied: LIRA denies access and provides a safe explanation.","2b. The person cancels sign-in, MFA, or consent: LIRA returns to the sign-in page without creating an authenticated session.","3a. Microsoft reports invalid credentials, disabled account, or a conditional-access failure: LIRA displays the permitted safe error and offers retry/support guidance.","4a. The callback contains an invalid, expired, or replayed result: LIRA rejects it and restarts sign-in safely.","5a. First-time provisioning fails or required profile attributes are unavailable: LIRA does not grant access until the account/profile can be resolved.","6a. No profile role exists or role lookup fails: LIRA withholds librarian-only access; public catalog browsing remains available where configured.","7a. The token is absent/expired or the account is not a librarian: the request is rejected and Koha is not changed."],
"special":"Microsoft 365 is the intended identity provider for sign-in and first-time access/account creation. Registration should be treated as institutional account sign-in plus LIRA profile provisioning/linking, unless the institution specifies a separate enrollment step. The current repository still contains email/password Supabase sign-in; the Microsoft flow is a target requirement and is not yet evidenced as implemented. Keep client secrets and privileged credentials on trusted server-side components, validate issuer/audience/state/nonce according to the selected identity flow, and never allow users to assign themselves privileged roles.",
"data":"Authentication identity, session token, user metadata, and profile role. Profile role values must be provisioned consistently with the librarian guard.","frequency":"Whenever a user signs in, registers, or enters a protected librarian operation.",
"open":"Confirm the institutional tenant/app registration, allowed account population, profile provisioning and linking rules, role assignment source, logout/session lifetime, and whether any separate enrollment or account approval is required."},
{
"id":"UC-02", "title":"View E-Books Library Catalog", "status":"Implemented (keyword browsing/search; semantic and hybrid search require backend configuration)",
"goal":"A Student/Faculty member finds, evaluates, and opens relevant catalog records and available digital resources.",
"scope":"LIRA OPAC, Catalog Service, Koha, optional Supabase vector index and OpenRouter embedding API", "level":"User goal", "primary":"Student/Faculty",
"secondary":"Koha REST API (authoritative bibliographic records); Supabase pgvector and OpenRouter when semantic search is enabled", "stakeholders":"Students/Faculty want accurate, understandable discovery. Librarians want catalog changes reflected in the OPAC. The library relies on Koha as the authoritative catalog.",
"trigger":"The user opens the OPAC, browses new arrivals, or submits a search query.",
"pre":"The application and catalog service are reachable, and Koha REST API is configured for catalog retrieval. The user signs in to LIRA with an eligible APC Microsoft 365 account when authentication is required. Semantic/hybrid mode additionally requires a complete embedding and vector-index configuration and an indexed catalog.",
"success":"LIRA displays normalized catalog records relevant to the request, with available details, resource links, and paging as applicable.",
"minimal":"The user receives a clear empty, unavailable, or error state; LIRA does not present fabricated catalog data as authoritative.",
"main":[("Actor","System"),("1. The user opens the OPAC and, when prompted, signs in with an APC Microsoft 365 account.","1.1 LIRA establishes the session and displays the catalog search page."),("2. The user types a title, author, ISBN, or phrase into the search field and chooses Keyword, Semantic, or Hybrid from the Search mode menu.","2.1 LIRA keeps the selected mode and query ready for submission."),("3. The user clicks Search.","3.1 LIRA sends the query and mode to the Catalog Service. Keyword mode searches Koha; Semantic mode searches the configured Supabase vector index; Hybrid mode combines both rankings."),("4. The user clicks a result title or card.","4.1 LIRA opens the record details and displays available metadata and digital-resource links."),("5. The user clicks an available Read/Open resource control or clicks Back to results.","5.1 LIRA opens the supported reader for that resource or returns to the results list." )],
"extensions":["1a. Koha is unavailable: the service returns a safe integration error and the OPAC displays an unavailable state.","2a. The query is blank: LIRA keeps the browse/new-arrivals flow rather than sending an empty search.","3a. Semantic configuration is absent or incomplete: the semantic request fails safely; the user can select Keyword mode.","3b. The vector index is stale or empty: semantic results may be incomplete; reindexing is an operational action, not an automatic catalog write.","4a. No matches exist: LIRA displays an empty-results message and permits the user to revise the query.","5a. The selected record has no usable digital resource: LIRA shows metadata and does not promise online reading."],
"special":"Keyword search remains the default. Semantic matching depends on OpenRouter embeddings and Supabase pgvector; it is not equivalent to the AI chatbot. Results are paginated by the service. Koha is authoritative for bibliographic records.",
"data":"Query, search mode, page/limit, normalized bibliographic record, resource metadata, and optional semantic-index metadata.","frequency":"Whenever a user browses or searches the catalog.",
"open":"The exact availability of semantic and hybrid modes depends on deployed environment configuration and index freshness."},
{
"id":"UC-03", "title":"Manage E-Books Library Catalog", "status":"Implemented in current catalog service source; deployment authorization and Koha permissions are prerequisites",
"goal":"A Librarian creates, inspects, updates, or deletes bibliographic catalog records and attaches supported digital resources or covers.",
"scope":"LIRA Librarian Catalog UI, Catalog Service, Koha REST API and Koha staff upload interface", "level":"User goal", "primary":"Librarian",
"secondary":"Koha (authoritative catalog); Supabase Auth/profile role lookup", "stakeholders":"Librarians need accurate records and accessible workflows. Students/Faculty need timely and correct catalog entries. The institution needs auditable, permission-controlled catalog changes.",
"trigger":"A librarian opens the librarian catalog page to add a record, select an existing record, or change its metadata/resources.",
"pre":"The librarian signs in to LIRA with an eligible APC Microsoft 365 account. LIRA has provisioned or linked the profile and assigned the librarian role through an authorized process. The catalog service has Koha REST credentials, and the Koha account has the required bibliographic and upload permissions.",
"success":"The requested record operation is accepted by Koha and LIRA displays the resulting record or confirms deletion. Uploaded files are represented by Koha resource URLs.",
"minimal":"Invalid or unauthorized changes do not reach Koha. On an integration failure, LIRA reports failure and does not claim that the record was saved.",
"main":[("Actor","System"),("1. The librarian signs in to LIRA with Microsoft 365 if no valid session is open, then opens the account menu and clicks Librarian side.","1.1 LIRA checks the profile role. If it is librarian, LIRA opens the management page and loads the record list."),("2. To add a book, the librarian clicks the + button labeled New record. To edit a book, the librarian clicks that book in the Records list.","2.1 LIRA opens a blank Add a book form or fills the editor with the selected Koha record."),("3. The librarian enters the required Title and any available Author, ISBN, publication year, publisher, language, item type, online URL, categories, and description.","3.1 LIRA keeps the entered values in the form and marks a missing required title for correction."),("4. To attach a cover, the librarian clicks the Book cover / thumbnail file field and chooses a JPEG, PNG, or WebP image.","4.1 For a new record, LIRA stages the selected cover until Create record is clicked. For an existing record, LIRA uploads the cover to Koha and attaches its URL immediately."),("5. To attach an e-book, the librarian clicks Upload PDF or EPUB to Koha and chooses a PDF or EPUB file.","5.1 For a new record, LIRA stages the file until record creation. For an existing record, LIRA uploads the file to Koha and attaches the resulting resource URL immediately."),("6. The librarian clicks Create record for a new book or Save changes for an existing book.","6.1 LIRA submits the record to the protected Catalog Service. The service validates the librarian token and writes the bibliographic record to Koha; staged cover/resource files are uploaded and attached."),("7. The librarian checks the success message and the updated Records list.","7.1 LIRA displays the saved record and its available cover/resource information."),("8. To delete a book, the librarian selects its row in Records, clicks Delete, and confirms the browser prompt.","8.1 LIRA asks Koha to delete the bibliographic record, removes it from the list after success, and displays the result." )],
"extensions":["1a. The user is not signed in: LIRA requests sign-in and does not load protected management actions.","1b. The profile role is not librarian: LIRA denies management access.","3a. Required title or a field constraint is invalid: the form or API returns validation feedback; no write is made.","4a. Koha rejects the create/update because of permissions, validation, or a duplicate/invalid value: LIRA displays a safe failure and preserves the editable form.","5a. File type, size, or upload configuration is invalid: the service rejects the upload; the librarian can correct the file or configuration.","5b. Upload succeeds but the subsequent metadata update fails: the file may exist in Koha without being attached to the record; LIRA reports the partial outcome so the librarian can retry or clean up.","7a. The librarian cancels confirmation: the record remains unchanged.","7b. Koha cannot be reached: LIRA reports failure and does not display a false success."],
"special":"The controller exposes protected POST/PUT/DELETE operations, and the service calls Koha create/update/delete methods. This conflicts with the older Catalog Service README statement that it is read-only; this description follows the current controller/service implementation. Verify the deployed build and Koha permissions before treating writes as operationally available. Upload limits and allowed resource formats are enforced by the service.",
"data":"Bibliographic fields, categories/subjects, resource URLs and formats, cover URL, uploaded file bytes, Koha bibliographic identifier, user token and role.","frequency":"As needed by library staff when catalog records or digital attachments change.",
"open":"Update the contradictory service README and confirm operational Koha account permissions, deletion policy, and audit requirements."},
{
"id":"UC-04", "title":"E-Book Recommendations", "status":"Implemented (deterministic client-side ranking; not an AI model call)",
"goal":"A Student/Faculty member discovers additional catalog records related to current interests and prior catalog activity.",
"scope":"LIRA OPAC and frontend recommendation service", "level":"User goal", "primary":"Student/Faculty",
"secondary":"Catalog Service/Koha for candidate records; Supabase-backed student library service for persisted activity where configured", "stakeholders":"Users want relevant suggestions and understandable signals. The library wants discovery to reflect its catalog. Users expect their activity data to be handled appropriately.",
"trigger":"The user opens the recommendations panel, searches, selects a book, or has recorded reading/view activity.",
"pre":"Catalog candidate records are available. To use saved activity and profile/school signals, the user signs in with an eligible APC Microsoft 365 account and has a linked LIRA profile. Query- or selection-based recommendations may use available context when history is absent.",
"success":"LIRA displays up to six candidate books ranked by matching catalog/activity features, excluding already viewed, read, or selected items.",
"minimal":"If no candidate has a positive score, LIRA displays an empty-state message and does not invent recommendations.",
"main":[("Actor","System"),("1. The user signs in with Microsoft 365 when personalized history is needed, opens the OPAC, and clicks the Recommendations button.","1.1 LIRA displays the recommendations panel and loads available catalog records, activity history, current query, selected book, and school context."),("2. The user optionally enters a query in the search field or selects a book.","2.1 LIRA compares candidate metadata and activity signals using its deterministic scoring rules."),("3. The user reviews the ordered recommendations.","3.1 LIRA displays up to six eligible records and the context signals used by the interface."),("4. The user clicks a recommended book title or cover.","4.1 LIRA opens the selected catalog record and records the view when the activity service is available." )],
"extensions":["1a. No history, query, selection, or school signal is available: LIRA displays no personalized list and provides an empty-state prompt.","1b. Activity history fails to load: recommendations proceed using remaining in-memory signals; the UI may show an activity message.","2a. Some candidate metadata is missing: the scorer uses the remaining fields; absent metadata is not inferred.","3a. No candidate scores above zero: no recommendations are shown."],
"special":"Recommendation ranking is implemented in frontend code using explicit scoring rules. It does not call OpenRouter or another generative AI model. Semantic catalog search is a separate optional feature. Recommendation quality is bounded by catalog metadata and recorded activity.",
"data":"Catalog metadata; recent book views/readings/searches; current query; selected record; school field; computed score held in the client.","frequency":"On demand when the recommendation section is visible or its context changes.",
"open":"Confirm consent, retention, and user controls for personalized activity data in the production policy."},
{
"id":"UC-05", "title":"Save and Organize a Personal Reading List", "status":"Implemented (requires signed-in user and configured Supabase data services)",
"goal":"A user saves catalog books to personal lists and maintains those lists for later discovery.",
"scope":"LIRA OPAC, personal lists UI, student library service, Supabase", "level":"User goal", "primary":"Student/Faculty",
"secondary":"Supabase Auth and database", "stakeholders":"Users want to keep and organize books. The library wants saved items associated with the correct account and recoverable across sessions.",
"trigger":"The user chooses Save/Bookmark on a catalog record or opens the lists page.",
"pre":"The user is signed in to LIRA with an eligible APC Microsoft 365 account, the LIRA profile is linked, Supabase personal-library storage is configured, and the catalog record is available.",
"success":"The record is saved to a selected personal list, or the user creates, renames, moves items between, or deletes a list as supported by the interface.",
"minimal":"A failed change is not reported as successful; existing list data remains available where the backend operation did not commit.",
"main":[("Actor","System"),("1. On a catalog record, the user clicks Save to a list.","1.1 LIRA opens the Save book dialog and loads the user's existing reading lists."),("2. The user selects a list, or enters a name and clicks Create list.","2.1 LIRA creates the list if requested and shows it as the selected destination."),("3. The user clicks Save in the dialog.","3.1 LIRA stores the selected book in that list and displays a saved confirmation."),("4. To organize saved books, the user opens My lists and selects a list tab.","4.1 LIRA loads and displays saved books for that list."),("5. The user clicks Rename, Move, Remove, or Delete list for the selected item/action and confirms if prompted.","5.1 LIRA saves the change, refreshes the affected list, and displays a status message." )],
"extensions":["1a. The user is signed out: LIRA requests sign-in or displays an authentication message; no personal save is made.","2a. The name is empty, too long, or conflicts with a supported uniqueness rule: LIRA asks for a valid name.","2b. Save fails because of connectivity or database policy: LIRA retains the current screen and reports the failure.","3a. No lists or saved books exist: LIRA displays an empty state and offers the relevant create/save action.","4a. The user cancels a destructive action: no list or bookmark is removed."],
"special":"Row-level access must ensure each user can read or modify only their own lists and bookmarks. This use case describes personal reading lists and saved items, not Koha loans, holds, or circulation transactions.",
"data":"User identifier, list identifier/name, Koha/LIRA book identifier, saved timestamp, list membership.","frequency":"Whenever a user saves or organizes books.",
"open":"Confirm the current schema's exact list naming rules, deletion behavior, and signed-out save UX."},
{
"id":"UC-06", "title":"Read an Available Digital Book", "status":"Implemented for supported resources; reading activity is recorded when available",
"goal":"A user opens and reads an available digital resource associated with a catalog record.",
"scope":"LIRA reader, Catalog Service resource endpoints, Koha-hosted resources and browser capabilities", "level":"User goal", "primary":"Student/Faculty",
"secondary":"Koha REST/staff file storage; browser PDF/EPUB/HTML capabilities; Supabase activity service", "stakeholders":"Readers want reliable access and useful controls. The library wants links to remain tied to correct catalog records and resource formats.",
"trigger":"The user selects Read/Open online for a catalog record with an eligible resource.",
"pre":"The catalog record exposes a usable resource URL or content endpoint. The file is an allowed format and accessible to the user. The user signs in to LIRA with an eligible APC Microsoft 365 account when authentication is required for the selected reader or activity history.",
"success":"The resource is displayed or opened using the available reader flow, and reading activity is recorded when the user is signed in and persistence succeeds.",
"minimal":"An unavailable or invalid resource is not presented as successfully opened. The user can return to the record or try another resource.",
"main":[("Actor","System"),("1. From a catalog detail page, the user clicks the available Read online or Open resource link.","1.1 LIRA opens the reader for the selected resource and identifies its format."),("2. The user waits for the resource to load.","2.1 LIRA retrieves supported text/HTML, PDF, or EPUB content through the Catalog Service where applicable, then renders it."),("3. The user clicks reader controls such as next/previous page, zoom, find, or Read aloud when those controls are available.","3.1 LIRA applies the selected reader action; Read aloud uses browser speech synthesis when supported."),("4. The user clicks Back to catalog or closes the reader.","4.1 LIRA records view/reading activity when the activity service is available and returns to the catalog." )],
"extensions":["1a. No resource is attached or the URL is not usable: LIRA explains that online reading is unavailable for that record.","2a. Koha/resource service is unavailable: LIRA reports a retrieval error and preserves a path back to the catalog.","2b. Format is unsupported or content validation fails: LIRA refuses to render the content and offers the catalog view.","2c. The client disconnects during binary transfer: the service cancels the stream and does not append a misleading successful response.","3a. Browser does not support a requested feature such as a selected voice: LIRA keeps basic reading available and omits that enhancement.","4a. Activity persistence fails: reading may continue; LIRA does not claim the history was saved."],
"special":"Resource content responses use safe headers and bounded streaming behavior. HTML is sandboxed by a restrictive content security policy. The reader does not imply that LIRA manages loans or circulation status.",
"data":"Catalog identifier, resource identifier/URL, media type, streamed content, user activity timestamps, reader preferences stored locally.","frequency":"Whenever a user opens an eligible digital resource.",
"open":"Confirm which resource types are supported in each deployed browser and whether access restrictions apply to specific holdings."},
{
"id":"UC-07", "title":"Ask Chatbot", "status":"Planned / not implemented as an interactive assistant in the current UI",
"goal":"A Student/Faculty user asks a library or research-support question and receives a useful, appropriately grounded answer.",
"scope":"Proposed LIRA assistant UI, FAQ/retrieval capability, approved knowledge sources, and AI provider", "level":"User goal", "primary":"Student/Faculty",
"secondary":"Future AI service/provider; approved library policy and FAQ sources; optional catalog retrieval", "stakeholders":"Students/Faculty want timely and trustworthy assistance. Librarians want consistent policy answers and appropriate escalation. The institution needs privacy and safe handling of prompts.",
"trigger":"The user opens the assistant and submits a natural-language question.",
"pre":"For a future implementation, the user is signed in with an eligible APC Microsoft 365 account and the LIRA profile is linked. The assistant service and approved knowledge sources are configured. The current UI only presents a coming-soon placeholder; no prompt submission flow is present.",
"success":"A response is displayed with appropriate source context or escalation guidance, and the user can ask a follow-up question.",
"minimal":"When an answer cannot be grounded or the service is unavailable, the user receives a clear limitation and a safe next step; unsupported claims are not presented as authoritative.",
"main":[("Actor","Future system behavior"),("1. The user clicks the LIRA assistant button in the OPAC.","1.1 LIRA opens the assistant panel and displays its purpose, limits, and message field."),("2. The user types a question in the message field and clicks Send.","2.1 LIRA validates the request and applies privacy and abuse controls."),("3. The user waits for a response.","3.1 The assistant retrieves approved policy/FAQ or catalog context and calls the configured model when needed."),("4. The user reads the response and clicks a source reference if they want to inspect it.","4.1 LIRA displays the answer, source references, and uncertainty/escalation guidance."),("5. The user types a follow-up and clicks Send, or clicks Close.","5.1 LIRA preserves only the conversation context allowed by the approved retention policy, or closes the panel." )],
"extensions":["2a. The question includes sensitive personal information: the assistant warns or handles it according to the approved privacy policy.","3a. No relevant approved source is found: the assistant declines to assert a policy answer and directs the user to library staff or official guidance.","3b. Provider timeout, rate limit, or malformed output: LIRA reports temporary unavailability and allows retry.","4a. Retrieved sources conflict or are outdated: the assistant identifies uncertainty and points to a human/official source.","5a. User requests an out-of-scope or unsafe action: the assistant refuses or redirects safely."],
"special":"This flow is included because it appears in the supplied use-case draft, but it is not an implemented capability. `ChatbotPlaceholder` explicitly states that the assistant is still being built. Do not document OpenRouter chat generation, conversational history persistence, FAQ retrieval, or ebook-summary retrieval as current behavior without implementation evidence.",
"data":"Future prompt, approved retrieved passages, response, citations/source identifiers, minimal operational telemetry subject to retention policy.","frequency":"Not available in current product; expected on demand after implementation.",
"open":"Specify authentication requirement, approved sources, retention period, provider, safety policy, citation format, and escalation destination."},
{
"id":"UC-08", "title":"Manage Chatbot", "status":"Planned / configuration service is documentation scaffold only",
"goal":"An authorized Librarian maintains approved assistant instructions and knowledge sources for future chatbot answers.",
"scope":"Proposed LIRA administration interface, chatbot configuration service, and configuration storage", "level":"User goal", "primary":"Librarian / designated administrator",
"secondary":"Future configuration service and database; future AI service consuming versioned configuration", "stakeholders":"Librarians need controlled updates. Students/Faculty need answers based on current approved guidance. Institution needs review, access control, version history, and rollback.",
"trigger":"A librarian opens assistant administration to review or change approved configuration.",
"pre":"A future configuration UI/API and storage are deployed. The librarian signs in with an eligible APC Microsoft 365 account, the profile has an authorized administrator role, and approved content sources are available. No working management UI or configuration API is evidenced in the current implementation.",
"success":"A validated configuration version is stored, reviewed, and made available to the assistant according to the release policy.",
"minimal":"Invalid or unauthorized configuration is not activated; the prior approved version remains available.",
"main":[("Actor","Future system behavior"),("1. The librarian signs in with Microsoft 365, opens the administration menu, and clicks Chatbot settings.","1.1 The system checks the administrator role and loads the active configuration and audit metadata."),("2. The librarian clicks the FAQ, Sources, or Rules tab and reviews the displayed content.","2.1 The system displays source, version, status, and last-editor details."),("3. The librarian clicks Edit or Upload source, changes the approved content, and enters required source details.","3.1 The system validates content format, permissions, size, and review metadata."),("4. The librarian clicks Preview, reviews the result, then clicks Submit for approval or Activate.","4.1 The system creates a new version and records who changed it and when."),("5. An authorized reviewer opens the pending version and clicks Approve.","5.1 The system activates the version and makes it available to future assistant requests." )],
"extensions":["1a. The user lacks administrator permission: access is denied and no configuration is disclosed.","3a. Content is malformed, oversized, unapproved, or duplicates a prohibited source: the system rejects it with actionable feedback.","4a. Validation or preview fails: the active version remains unchanged.","5a. Approval is denied: the draft remains inactive and the reviewer records a reason.","5b. Activation fails: the system retains the previous active version and reports the failed deployment."],
"special":"The supplied AI-service and chatbot-configuration READMEs describe intended boundaries, not complete implementation. Configuration changes should be versioned and audited before this use case is marked implemented.",
"data":"Configuration version, system instructions, approved source metadata/content, reviewer/author identifiers, timestamps, activation state, audit events.","frequency":"Infrequent; when library policy, approved FAQ content, or assistant behavior changes.",
"open":"Define who can author/review/activate, what content may be stored, and the rollback/audit process."},
{
"id":"UC-09", "title":"Generate Citation", "status":"Planned / citation generation is not implemented in the current user flow",
"goal":"A user obtains a citation in a supported style using reliable bibliographic metadata.",
"scope":"Proposed LIRA catalog detail/reader and citation formatter", "level":"User goal", "primary":"Student/Faculty",
"secondary":"Catalog Service/Koha metadata; future citation formatter", "stakeholders":"Students/Faculty need accurate citations. Librarians need metadata integrity and reliable attribution.",
"trigger":"The user selects Generate Citation from a catalog record.",
"pre":"The user is signed in to LIRA with an eligible APC Microsoft 365 account, and trusted bibliographic fields are available for the selected record. The current UI displays record metadata/abstract where present but has no citation-generation action.",
"success":"The user receives a citation in the selected supported style, based only on available catalog metadata.",
"minimal":"Missing metadata is identified; LIRA does not fabricate bibliographic fields.",
"main":[("Actor","Future system behavior"),("1. The user selects Generate Citation for a catalog record.","1.1 LIRA obtains the record's trusted bibliographic metadata."),("2. The user chooses a supported citation style.","2.1 LIRA checks required fields and identifies missing metadata."),("3. The user submits the request.","3.1 LIRA formats the available trusted fields in the selected style."),("4. The user reviews or copies the citation.","4.1 LIRA displays the citation and identifies any omitted fields." )],
"extensions":["2a. Required citation metadata is missing: LIRA flags the missing fields and formats only what can be responsibly cited, or asks the user to select another record.","3a. The formatter is unavailable: LIRA reports a temporary error without losing the catalog context.","3b. Output is empty or malformed: LIRA rejects it and offers a retry."],
"special":"Citation generation is not currently wired into the user flow. Use catalog metadata as the source of truth and never silently invent fields.",
"data":"Trusted bibliographic metadata, citation style, formatted citation, and missing-field notices.","frequency":"Not available in current product; expected on demand after implementation.",
"open":"Choose supported citation styles, required metadata fields, and attribution format."},
{
"id":"UC-11", "title":"Retrieve E-book Summary", "status":"Planned / no generated-summary flow is implemented in the current user interface",
"goal":"A Student/Faculty member receives a concise summary of an eligible e-book with the source clearly identified.",
"scope":"Proposed LIRA chatbot/reader, catalog resource retrieval, and future summary capability", "level":"User goal", "primary":"Student/Faculty",
"secondary":"Catalog Service/Koha resource metadata; future AI summary service", "stakeholders":"Students/Faculty want a useful overview before or during reading. Librarians want summaries tied to the correct resource. Authors and publishers require appropriate content use and attribution.",
"trigger":"The user requests Retrieve E-book Summary from the chatbot or an eligible catalog record.",
"pre":"The user is signed in to LIRA with an eligible APC Microsoft 365 account. The selected record has a retrievable digital resource or approved summary source, and the future summary service and content-use rules are configured. The current UI does not provide generated summaries.",
"success":"LIRA displays a concise generated summary labeled as a summary and linked to the source record/resource.",
"minimal":"If content cannot be retrieved or used, LIRA explains that a summary is unavailable and does not substitute invented text.",
"main":[("Actor","Future system behavior"),("1. The user requests a summary for a selected e-book.","1.1 LIRA identifies the catalog record and checks whether an eligible source is available."),("2. The user confirms the selected record/resource.","2.1 LIRA retrieves permitted text or an approved source passage through the catalog resource flow."),("3. The user submits the request.","3.1 The summary service processes the permitted source within configured length and content rules."),("4. The user reviews the result.","4.1 LIRA displays the summary with source attribution and a route back to the catalog record or reader." )],
"extensions":["1a. The record has no eligible digital resource: LIRA states that summary retrieval is unavailable for this record.","2a. The resource is restricted, unsupported, or unavailable: LIRA stops retrieval and does not send unavailable content to the summary service.","3a. The provider times out or returns an invalid response: LIRA reports a temporary failure and offers retry.","3b. The generated summary lacks adequate source grounding: LIRA rejects it or clearly reports that no reliable summary could be produced.","4a. The user closes the result: LIRA returns to the record or conversation without altering the source catalog."],
"special":"This is a planned capability from the use case diagram. The catalog's existing description/abstract is source metadata and must not be labeled as a generated full-book summary. Define copyright, provider retention, length, and attribution controls before implementation.",
"data":"Catalog and resource identifiers, permitted source text/passages, summary request options, generated summary, source attribution, provider status.","frequency":"Not available in the current product; expected on demand after implementation.",
"open":"Define eligible resources, content-use restrictions, summary length, provider/retention controls, source display, and failure behavior."},
{
"id":"UC-10", "title":"Manage Reports", "status":"Planned / no report UI or report endpoints evidenced in the current implementation",
"goal":"An authorized Librarian reviews catalog/usage measures for a defined period and exports an operational report.",
"scope":"Proposed LIRA staff reporting interface, analytics service, and approved catalog/activity sources", "level":"User goal", "primary":"Librarian / authorized staff",
"secondary":"Future analytics service; Koha catalog data; approved LIRA activity/usage stores", "stakeholders":"Librarians need reliable, timely operational insight. Users expect activity data to be used appropriately. Institution needs controlled access, clear metric definitions, and privacy-aware aggregation.",
"trigger":"A librarian chooses a report type and requests a report for a time range.",
"pre":"A future analytics service and staff interface are available. The librarian signs in with an eligible APC Microsoft 365 account and has an authorized reporting role. Data sources, time zone, filters, metric definitions, and aggregation/privacy rules are configured. Current repository documentation outlines reports but no report workflow was found.",
"success":"The system displays or exports a report with clear scope, filters, timestamp, and metric definitions.",
"minimal":"The system does not present partial or stale results as complete; failed exports are reported and sensitive individual data is not exposed to unauthorized users.",
"main":[("Actor","Future system behavior"),("1. The librarian opens Reports.","1.1 The system verifies staff authorization and lists available report types."),("2. The librarian selects cataloging, usage, or another approved report and sets the time range/filters.","2.1 The system validates the requested period, timezone, dimensions, and access scope."),("3. The librarian requests the report.","3.1 The analytics service aggregates approved source data and identifies coverage/freshness limitations."),("4. The librarian reviews the result.","4.1 The system displays totals/trends with definitions, selected filters, and generation time."),("5. The librarian selects CSV or PDF export where offered.","5.1 The system generates a bounded export with a predictable filename and correct content type." )],
"extensions":["2a. The requested range is invalid or exceeds permitted limits: the system asks the librarian to correct the filters.","3a. A source is unavailable or data coverage is incomplete: the system identifies the limitation and avoids implying completeness.","3b. The report is too large: the system rejects it or processes it through a bounded asynchronous job with status feedback.","4a. No records match: the system displays a zero-result report with the chosen scope.","5a. Export generation fails: the system preserves the on-screen report if possible and offers retry."],
"special":"The analytics-service README is an architectural description, not evidence of a functioning reporting feature. Define aggregation and privacy controls before exposing usage data; do not assume loan or chatbot metrics exist in LIRA merely because they appear in a target report list.",
"data":"Report type, date/time range and timezone, filters, aggregated metrics, data freshness, export format, requesting staff identifier, audit metadata.","frequency":"As requested by library staff; scheduled reports are outside this use case unless separately specified.",
"open":"Decide supported report catalog, data sources, privacy thresholds, time zone, export formats, retention, and audit policy."}
]

related_use_cases = {
    "UC-01": "View E-Books Library Catalog; Manage E-Books Library Catalog; Manage Chatbot; Ask Chatbot; Manage Reports.",
    "UC-02": "Manage E-Books Library Catalog; E-Book Recommendations; Generate Citation; Retrieve E-book Summary.",
    "UC-03": "View E-Books Library Catalog. Create E-Books, Read E-Books, Update E-Books, and Delete E-Books are flows within this use case.",
    "UC-04": "View E-Books Library Catalog; Save and Organize a Personal Reading List; Read an Available Digital Book.",
    "UC-05": "View E-Books Library Catalog; E-Book Recommendations; Read an Available Digital Book.",
    "UC-06": "View E-Books Library Catalog; E-Book Recommendations.",
    "UC-07": "Manage Chatbot; Answer FAQ; Retrieve E-book Summary.",
    "UC-08": "Ask Chatbot.",
    "UC-09": "View E-Books Library Catalog.",
    "UC-10": "Generate E-Book Cataloging Reports; Generate E-Book Usage Report.",
    "UC-11": "Ask Chatbot; View E-Books Library Catalog."
}

# Keep the diagram's primary catalog-management use case first. The Microsoft
# 365 sign-in scenario is a precondition for relevant flows, not a separate UC.
old_order = ['UC-03', 'UC-02', 'UC-08', 'UC-07', 'UC-10', 'UC-04', 'UC-09', 'UC-11', 'UC-05', 'UC-06']
case_by_id = {case['id']: case for case in cases if case['id'] != 'UC-01'}
old_related = related_use_cases
cases = [case_by_id[old_id] for old_id in old_order]
related_use_cases = {}
for new_number, old_id in enumerate(old_order, start=1):
    new_id = f'UC-{new_number:02d}'
    case_by_id[old_id]['id'] = new_id
    related_use_cases[new_id] = old_related[old_id]

def set_cell_text(cell, text, bold=False, color=None, size=9):
    cell.text = ''
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(text)
    r.bold = bold
    r.font.size = Pt(size)
    if color:
        r.font.color.rgb = RGBColor(*color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

def add_field_table(doc, fields):
    table = doc.add_table(rows=0, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = 'Table Grid'
    table.columns[0].width = Inches(1.55)
    table.columns[1].width = Inches(5.8)
    for label, value in fields:
        cells = table.add_row().cells
        cells[0].width = Inches(1.55)
        cells[1].width = Inches(5.8)
        set_cell_text(cells[0], label, bold=True, color=(0, 0, 0))
        set_cell_text(cells[1], value)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)

def add_bullets(doc, title, items):
    doc.add_heading(title, level=2)
    for item in items:
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
        p.add_run(item)

doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(.65)
sec.bottom_margin = Inches(.65)
sec.left_margin = Inches(.75)
sec.right_margin = Inches(.75)
styles = doc.styles
styles['Normal'].font.name = 'Aptos'
styles['Normal'].font.size = Pt(9)
styles['Normal'].paragraph_format.space_after = Pt(4)
for name, size, color in [('Title', 24, (0,0,0)), ('Heading 1', 16, (0,0,0)), ('Heading 2', 11, (0,0,0))]:
    st = styles[name]
    st.font.name = 'Aptos Display'
    st.font.size = Pt(size)
    st.font.bold = True
    st.font.color.rgb = RGBColor(*color)

for case_index, c in enumerate(cases):
    if case_index > 0:
        doc.add_page_break()
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run('Use Case Full Description:')
    r.bold = True; r.font.size = Pt(13); r.font.color.rgb = RGBColor(0, 0, 0)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(9)
    r = p.add_run(f"{c['id']}  {c['title']}")
    r.bold = True; r.font.size = Pt(20); r.font.color.rgb = RGBColor(0, 0, 0)
    add_field_table(doc, [
        ('Use Case Name:', f"{c['id']} — {c['title']}"), ('Implementation Status:', c['status']),
        ('Scenario:', c['goal']),
        ('Triggering Event:', c['trigger']), ('Brief Description:', f"Scope: {c['scope']}\nGoal level: {c['level']}\n{c['goal']}"),
        ('Actors:', f"Primary: {c['primary']}\nSupporting: {c['secondary']}"),
        ('Related Use Cases:', related_use_cases[c['id']]),
        ('Stakeholders:', c['stakeholders']), ('Preconditions:', c['pre']),
        ('Postconditions:', f"Success: {c['success']}\nMinimum guarantee: {c['minimal']}"),
    ])
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    flow = doc.add_table(rows=1, cols=3)
    flow.style = 'Table Grid'; flow.alignment = WD_TABLE_ALIGNMENT.CENTER
    flow.columns[0].width = Inches(1.25)
    flow.columns[1].width = Inches(2.9)
    flow.columns[2].width = Inches(3.2)
    for i, head in enumerate(('Flow of Activities:', 'Actor', 'System')):
        set_cell_text(flow.rows[0].cells[i], head, bold=True, color=(0, 0, 0))
    for actor, system in c['main'][1:]:
        cells = flow.add_row().cells
        set_cell_text(cells[0], '')
        set_cell_text(cells[1], actor)
        set_cell_text(cells[2], system)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    add_field_table(doc, [('Exception Conditions:', '\n'.join(c['extensions']))])
    add_field_table(doc, [
        ('Special Requirements:', c['special']), ('Data / Information:', c['data']),
        ('Frequency:', c['frequency']), ('Open Issues:', c['open'])])

doc.add_page_break()
p = doc.add_paragraph()
r = p.add_run('Use Case Full Description:')
r.bold = True; r.font.size = Pt(14); r.font.color.rgb = RGBColor(0, 0, 0)
doc.add_paragraph('APC Library Intelligent Research Assistant (LIRA) · Traceability Notes')
references = [
    'frontend/src/services/authService.js — current implementation uses Supabase email/password; Microsoft 365 is the requested target sign-in method and is stated in relevant preconditions.',
    'frontend/src/pages/OpacPage.jsx and frontend/src/services/catalogService.js — OPAC browsing, search modes, recommendations, profile/activity interactions.',
    'frontend/src/services/catalogRecommendations.js — deterministic client-side recommendation scoring.',
    'frontend/src/pages/LibrarianCatalogPage.jsx — librarian catalog CRUD and upload UI.',
    'backend/catalog-service/src/catalog/catalog.controller.ts and catalog.service.ts — protected catalog writes, Koha integration, search and resource endpoints.',
    'backend/catalog-service/README.md — catalog architecture and optional semantic-search setup; read-only statement conflicts with current source write routes.',
    'frontend/src/components/chatbot/ChatbotPlaceholder.jsx — assistant is explicitly marked as not yet available.',
    'backend/ai-service and backend/analytics-service README files — intended service boundaries, not evidence of finished user flows.',
    'frontend/src/pages/ReaderPage.jsx and frontend/src/services/studentLibraryService.js — reader and personal activity/list features.'
]
add_field_table(doc, [
    ('Basis:', 'This draft was reconciled against the supplied LIRA use-case DOCX, the use-case diagrams, and current repository source/documentation. Status notes distinguish target behavior from implemented behavior.'),
    ('Implementation Notes:', '\n'.join(references)),
    ('Before Approval:', 'Confirm the target release scope for planned chatbot/report/citation features; resolve the catalog read-only documentation conflict; validate Microsoft 365 account provisioning and role assignment; and confirm operational permissions/configuration in the deployed environment.')])

doc.save(OUT)
print(OUT)
