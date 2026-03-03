---
name: feature-change-flow
description: End-to-end feature change workflow for this project, from database migration through SQL compilation, views/resources/artifacts layers, client, testing, and formatting. Use when implementing new features or modifying existing behavior.
---

# Feature Change Flow

Start at the lowest required layer and proceed forward from there:
- If you start at migrations, complete steps 1-7.
- If you start at SQL, complete steps 2-7.
- If you start at views/resources, complete steps 3-7.
- If you start at artifacts, complete steps 4-7.
- If you start at client, complete steps 5-7.
- Always complete step 7.

## 1. Database migration (if needed)
- Update `database/app` and `database/seed`.
- Create a new migration in `database/migrate/` with incremented prefix.
- Run `make migrate-db` and iterate until it succeeds.
- Export schema with `make export-db schema`.

## 2. SQL queries
- Update SQL in `server/app/v5/sql/queries/[resource]/[operation]_complete.sql`.
- Use composite types in `types` schema — never JSONB.
- Use parameterized SQL (`$1`, `$2`) — no string interpolation.
- **Run `make sql-compile`** to execute functions and regenerate `server/app/sql/types.py`.

## 3. Server views and resources
- **Views** (`server/app/v5/api/views/`): Read layer querying MVs, declarative SQL filters, `*_internal()` functions.
- **Resources** (`server/app/v5/api/resources/`): Reusable data-access with per-resource caching, `*_internal()` functions.
- Use `execute_sql_typed()` for all SQL execution.

## 4. Server artifacts and socket
- **Artifacts** (`server/app/v5/api/main/`): BFF aggregation — combines views + resources + permissions.
  - Two-pass pattern: SQL for metadata (Pass 1), parallel `*_internal()` calls (Pass 2).
  - `permissions.py`: Pure Python business logic — no SQL.
  - Standard files: `types.py`, `permissions.py`, `get.py`, `list.py`, `save.py`, `delete.py`, `draft.py`.
- **Socket** (`server/app/v5/socket/artifacts/`): AI generation handlers (generate, complete, progress, error).

## 5. Client
- Add server actions in `client/app/(main)/[resource]/page.tsx`.
- Use `InputOf`/`OutputOf` with `/api/v5/...` types.
- Use `api.post("/[resource]/[operation]")` (no `/api/v5` prefix).
- Run `make openapi-gen` then `make gen-client-types` if route signatures changed.

## 6. Testing
- Prefer API testing at `localhost:8000`.
- Use headers:
  - `X-Profile-Id: 019b3be4-36f0-788c-9df2-481eb5917940`
  - `X-Bypass-Cache: 1` (optional)
- Integration tests: `server/tests/integration/api/v5/[resource]/`
- E2E tests: `server/tests/e2e/` (Playwright, requires `make run-test` first)

## 7. Formatting / code quality
- Transactions for mutations only, not for reads.
- Error handling: HTTPException (re-raise), ValueError (400), Exception (`handle_route_error`).
- Cache: `get_cached()`/`set_cached()` for reads, `invalidate_tags()` after mutations.
