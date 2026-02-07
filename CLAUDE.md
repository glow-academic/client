# GLOW - Claude Code Instructions

## Quick Start

```bash
make run          # Start all services (database, client, server, redis)
make stop         # Stop all services
make test         # Run server tests (unit + integration)
make help         # Show all commands
```

## Architecture: Three-Layer BFF

| Layer | Location | Purpose |
|-------|----------|---------|
| **Views** | `server/app/api/v4/views/` | Read layer — queries MVs with declarative SQL filters, `*_internal()` |
| **Resources** | `server/app/api/v4/resources/` | Cached data-access functions, `*_internal()` for reuse |
| **Artifacts** | `server/app/api/v4/artifacts/` | BFF aggregation — views + resources + permissions |
| **Socket** | `server/app/socket/v4/artifacts/` | WebSocket AI generation (generate, complete, progress, error) |
| **Permissions** | `*/permissions.py` per artifact | Pure Python business logic — no SQL |

## Type Flow

```
SQL files (server/app/sql/v4/queries/)
    ↓ make sql-compile
server/app/sql/types.py (*SqlParams, *SqlRow)
    ↓ make openapi-gen
server/openapi.json
    ↓ make gen-client-types
client/lib/api/schema.ts → InputOf / OutputOf
```

**After editing SQL:** Always run `make sql-compile` to regenerate types.

## File Locations

```
server/app/sql/v4/queries/[resource]/       — SQL files (one per route)
server/app/api/v4/artifacts/[resource]/     — Artifact endpoints
server/app/api/v4/resources/[resource]/     — Resource endpoints
server/app/api/v4/views/[domain]/           — View endpoints
server/app/socket/v4/artifacts/[resource]/  — Socket handlers
server/tests/integration/api/v4/[resource]/ — Integration tests
server/tests/e2e/                           — E2E Playwright tests
client/app/(main)/[resource]/page.tsx       — Server actions
client/components/[resource]/               — UI components
```

## Key Patterns

- **Two-pass fetching**: Artifact endpoints do Pass 1 (SQL for IDs), Pass 2 (parallel `*_internal()` via `asyncio.gather()`)
- **SQL execution**: All via `execute_sql_typed()` — no inline SQL in Python
- **Composite types**: In `types` schema — never JSONB
- **Transactions**: For mutations only, not for reads
- **Cache**: `get_cached()`/`set_cached()` for reads, `invalidate_tags()` after mutations
- **Profile ID**: From `http_request.state.profile_id` (set by X-Profile-Id header)
- **Declarative SQL filters**: `(param IS NULL OR column = param)` — no dynamic WHERE building

## Database Migrations

```bash
ls database/migrate/ | sort -n | tail -1   # Find latest number
# Create: database/migrate/{next_number}_{desc}.sql
make migrate-db                             # Apply migration
```

## Testing

```bash
make test-unit          # Unit tests (no setup needed)
make test-integration   # Integration tests (no setup needed)
make test-cov           # With coverage
make run-test           # Start test services (for E2E)
make test-e2e           # E2E Playwright tests
```

- **API test profile**: `019b3be4-36f0-7ebd-ac27-52e3dba461f1` (superadmin)
- **E2E test profile**: `965bd24f-dfae-4063-b370-e1373df46322`

## Database Credentials

```bash
psql postgresql://myuser:mypassword@localhost:5432/mydb
```

## Code Quality

```bash
make format     # Ruff formatter
make lint       # Ruff linter
make typecheck  # MyPy
```
