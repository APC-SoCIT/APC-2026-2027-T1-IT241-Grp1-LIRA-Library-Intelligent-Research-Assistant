Microsoft SSO and OAuth handling. This service coordinates sign-in redirects, callback validation, identity claims, session creation, and sign-out behavior for the LIRA platform.

It is responsible for validating provider responses and exposing only the user and authorization information required by other services. Token handling, callback errors, account provisioning, and session expiry should be logged without recording credentials or raw tokens. Lira-01, Lira-06
