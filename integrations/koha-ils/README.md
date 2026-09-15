Koha ILS API wrapper shared by the catalog and loans services. This adapter translates LIRA's internal catalog and circulation needs into Koha requests and maps vendor responses into stable service-facing models.

Connection settings and credentials must come from the runtime environment. The wrapper should centralize timeouts, retries, authentication, pagination, error mapping, and observability so catalog and loans services do not implement separate Koha clients.
