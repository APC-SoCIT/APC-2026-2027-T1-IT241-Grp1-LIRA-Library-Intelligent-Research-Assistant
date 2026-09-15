# Store

State management for the user session and chat history. This area holds client state that must survive component changes or be shared by multiple routes, such as the authenticated user, permissions, conversation messages, and selected context.

The store should distinguish durable client state from transient request state and should never persist sensitive access tokens in an unsafe browser location.
