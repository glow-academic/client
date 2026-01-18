---
name: feature-change-flow
description: End-to-end feature change workflow for this project, from database migration through SQL, routes, client, testing, and formatting. Use when implementing new features or modifying existing behavior.
---

# Feature Change Flow

Start at the lowest required layer and proceed forward from there:
- If you start at migrations, complete steps 1-6.
- If you start at SQL, complete steps 2-6.
- If you start at server routes, complete steps 3-6.
- If you start at client, complete steps 4-6.
- Always complete step 6.

## 1. Database migration (if needed)
- Update `database/app` and `database/seed`.
- Create a new migration in `database/migrate/` with incremented prefix.
- Run `make migrate-db` and iterate until it succeeds.
- Export schema with `make export-db schema`.

## 2. SQL queries
- Update SQL in `server/app/sql/v4/[resource]/[operation]_complete.sql`.
- Use parameterized SQL and keep queries in SQL files (no inline SQL).

## 3. Server routes
- One SQL file per Python route in `server/app/api/v4/...`.
- Use auto-generated types via `execute_sql_typed()`.

## 4. Client
- Add server actions in `client/app/(main)/[resource]/page.tsx`.
- Use `InputOf`/`OutputOf` with `/api/v4/...` types.
- Use `api.post("/[resource]/[operation]")` (no `/api/v4` prefix).

## 5. Testing
- Prefer API testing at `localhost:8000`.
- Use headers:
  - `X-Profile-Id: 019b3be4-36f0-7ebd-ac27-52e3dba461f1`
  - `X-Bypass-Cache: 1` (optional)

## 6. Formatting / code quality
- Keep SQL and routes aligned with project standards.
- Use transactions for mutations, not for reads.
