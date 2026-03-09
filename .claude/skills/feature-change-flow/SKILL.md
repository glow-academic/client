---
name: feature-change-flow
description: End-to-end feature change workflow for this project, from database migration through views/resources/artifacts layers, client, testing, and formatting. Use when implementing new features or modifying existing behavior.
---

# Feature Change Flow

Start at the lowest required layer and proceed forward from there:
- If you start at migrations, complete steps 1-6.
- If you start at views/resources, complete steps 2-6.
- If you start at artifacts, complete steps 3-6.
- If you start at client, complete steps 4-6.
- Always complete step 6.

## 1. Database migration (if needed)
- Update `database/app` and `database/seed`.
- Create a new migration in `database/migrate/` with incremented prefix.
- Run `make migrate-db` and iterate until it succeeds.
- Export schema with `make export-db schema`.

## 2. Server views and resources
- **Views** (`server/app/routes/v5/api/views/`): Read layer querying MVs, declarative SQL filters, `*_internal()` functions.
- **Resources** (`server/app/routes/v5/api/resources/`): Reusable data-access with per-resource caching, `*_internal()` functions.
- **Entry functions** (`server/app/routes/v5/tools/entries/`): Black box functions for mutations (group→run→call→domain entry chains).
- Hand-craft Pydantic types in `routes/shared_types.py` or per-route `types.py` files.

## 3. Server artifacts and socket
- **Artifacts** (`server/app/routes/v5/api/main/`): BFF aggregation — combines views + resources + permissions.
  - Two-pass pattern: SQL for metadata (Pass 1), parallel `*_internal()` calls (Pass 2).
  - `permissions.py`: Pure Python business logic — no SQL.
  - Standard files: `types.py`, `permissions.py`, `get.py`, `list.py`, `save.py`, `delete.py`, `draft.py`.
- **Socket** (`server/app/routes/v5/socket/artifacts/`): AI generation handlers (generate, complete, progress, error).

## 4. Client
- Add server actions in `client/app/(main)/[resource]/page.tsx`.
- Use `InputOf`/`OutputOf` with `/api/v5/...` types.
- Use `api.post("/[resource]/[operation]")` (no `/api/v5` prefix).
- Run `make openapi-gen` then `make gen-client-types` if route signatures changed.

## 5. Testing
- Prefer API testing at `localhost:8000`.
- Use headers:
  - `X-Profile-Id: 019b3be4-36f0-788c-9df2-481eb5917940`
  - `X-Bypass-Cache: 1` (optional)
- Integration tests: `server/tests/integration/api/v5/[resource]/`
- E2E tests: `server/tests/e2e/` (Playwright, requires `make run-test` first)

## 6. Formatting / code quality
- Transactions for mutations only, not for reads.
- Error handling: HTTPException (re-raise), ValueError (400), Exception (`handle_route_error`).
- Cache: `get_cached()`/`set_cached()` for reads, `invalidate_tags()` after mutations.
