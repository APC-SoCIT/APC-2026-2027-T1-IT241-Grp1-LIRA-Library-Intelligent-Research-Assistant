Book checkout/return workflows and overdue alerts. This service coordinates circulation actions, checks borrowing eligibility and availability, records loan state, and exposes current due dates to authenticated users.

It should make operations idempotent where retries are possible and keep overdue detection separate from notification delivery. Koha-specific calls belong behind the shared Koha integration boundary. Lira-03
