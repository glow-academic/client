---
name: dhh-architecture
description: DHH-style API architecture guide for this project, including one SQL file per route, composite types (no JSONB), and auto-generated types. Use when modifying v4 API routes or SQL files.
---

# DHH-Style Architecture

Follow this pattern for v4 API route changes:

1. Update the SQL file in `server/app/sql/v4/[resource]/[operation]_complete.sql`.
   - Define PostgreSQL functions with `RETURNS TABLE` or composite types.
   - Use composite types in `types` schema; never use JSONB.
   - Use `execute_sql_typed()` (auto-detects function and types).

2. Update the route file in `server/app/api/v4/[resource]/[operation].py`.
   - Use auto-generated types from SQL introspection.
   - Profile ID is `http_request.state.profile_id`.
   - No inline SQL in Python.

3. Update server actions if the client calls the route.
   - `client/app/(main)/[resource]/page.tsx` with `"use server"`.
   - Use `InputOf<"/api/v4/...">` and `OutputOf<"/api/v4/...">`.

4. Update tests as needed.
   - Integration tests in `server/tests/integration/v4/[resource]/`.
   - E2E tests in `server/tests/e2e/`.

Key principles:
- One SQL file per route; one Python file per route.
- Composite types, not JSONB.
- No service/repository layers; routes execute SQL directly.
- No inline SQL in Python.
