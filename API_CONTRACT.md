# API contract foundation

API routes use `/api/v1`, JSON content types and URI versioning. Requests carry a Fastify request ID; correlation IDs are propagated through logs/jobs when introduced. Validate at boundaries, return structured safe errors without stack traces, and never accept client-authoritative money or role data. Payment return URLs never change business state.
