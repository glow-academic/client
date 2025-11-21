# Contributor Guide

## Quick Start

The easiest way to start all services:

```bash
make run
```

This starts:
- Database (from latest backup)
- Client (Next.js dev server)
- Server (FastAPI with uvicorn)
- Redis (for WebSocket scaling)

All services run in foreground with color-coded logs. Press Ctrl+C to stop all.

### Available Commands

```bash
make run              # Start all services (foreground, combined logs)
make stop             # Stop all services
make test             # Run all server tests (unit + integration)
make test-unit        # Unit tests for utils and utilities
make test-integration # Integration tests for all endpoints
make test-e2e         # End-to-end tests with Playwright
make test-cov         # Server tests with coverage
```

For more commands, run `make help`.

## Setup

### Prerequisites
- **PostgreSQL** (brew/apt/yum install postgresql)
- **Python 3.11** with virtual environment
- **Node.js and Yarn** for the client
- **Redis** (for WebSocket scaling)

### Installation

```bash
make setup           # Create Python virtual environment
make install         # Install Python dependencies (from pyproject.toml)
make install-client  # Install client dependencies (yarn)
```

### Database Setup

```bash
make restore-db  # Restore database from latest backup
make fresh-db    # Fresh database (backup first, then init.sql)
make migrate-db  # Apply pending migrations
make connect-db  # Connect to database shell
```

## Testing Instructions

### Test Structure

**No client-side unit testing** - All testing happens on the server side.

**Server Testing Strategy**:
- **Unit tests**: For utils and small utilities (`server/tests/unit/`)
- **Integration tests**: For all endpoints (`server/tests/integration/v3/`)
- **E2E tests**: Playwright tests for whole user flows (`server/tests/e2e/`)

### Running Tests

**Unit and Integration Tests (no setup needed):**
```bash
make test          # Run unit + integration tests
make test-unit     # Unit tests (server/tests/unit/)
make test-integration # Integration tests (server/tests/integration/)
make test-cov      # Run with coverage report
make test server/tests/test_specific.py  # Run specific test file
```

**End-to-End Tests (requires test services running):**
```bash
make run-test      # Start all services in TEST mode (required first)
make test-e2e      # Run E2E tests with Playwright (headless)
make test-e2e-headed  # Run E2E tests with browser visible
```

**Note**: Unit and integration tests can run directly without any services running. E2E tests require `make run-test` to spin up test services first.

### Coverage Reports
- **Server**: HTML report in `server/htmlcov/index.html`
- **Target**: 80% coverage for server

## Database Migrations

### Migration Commands

```bash
make migrate-db  # Apply pending migrations from migrate/ folder
```

### Migration Workflow
1. Make schema changes in `database/app/` SQL files
2. Create migration file: Create new SQL file in `database/migrate/` folder
3. Write migration SQL: Use `DO $$ BEGIN ... END $$` blocks for conditional DDL
4. Apply migration: `make migrate-db`
5. Restart services: `make stop && make run`

**Note**: Migrations are manual SQL files in `database/migrate/` folder. Server uses asyncpg for all database operations.

## Code Quality

**Formatting & Linting:**
```bash
make format      # Format code with Ruff
make lint        # Run linter checks
make typecheck   # Run MyPy type checking (server)
```

**Client:**
```bash
cd client && npx tsc --noEmit
```

## Key Files & Folders

### Root
- `Makefile` - All commands for development workflow
- `pyproject.toml` - Project configuration, dependencies, tooling (Ruff, MyPy, pytest)
- `requirements.txt` - Server dependencies (generated from pyproject.toml)

### Client
- `client/package.json` - Client dependencies and scripts
- `client/app/(main)/` - Next.js pages with server actions (`"use server"`)
- `client/components/` - React components (airgapped UI - presentation only)

### Database  
- `database/migrate/` - Manual migration SQL files
- `database/app/` - Schema definitions (SQL files)
- `database/seed/` - Seed data scripts

### Server
- `server/app/api/v3/[resource]/` - FastAPI routes (1 Python file per route)
- `server/sql/v3/[resource]/` - SQL files (1 SQL file per route)
- `server/app/utils/` - Utility functions (used by routes)

## Architecture Principles

### Client: Airgapped UI (Server Actions Dominate)
- **Server actions**: Next.js server actions (`"use server"`) are the primary pattern for backend communication
- **Airgapped**: Client is airgapped to expose information only - no business logic
- **Presentation only**: Components focus on rendering and user interactions
- **No client-side unit testing**: All testing happens on the server side

### Server: DHH-Style Architecture
- **1 SQL file per route**: Each route has a corresponding SQL file in `server/sql/v3/[resource]/[operation].sql`
- **1 Python file per route**: Each route is a single Python file (e.g., `detail_default.py`, `create.py`)
- **No abstraction layers**: Routes directly execute SQL using `load_sql()` helper - no service/repository layers
- **Direct SQL execution**: Routes own transaction and execution control
- **Testing**: Unit tests (utils), integration tests (endpoints), E2E tests (Playwright)

### Database: BCNF & No Nulls
- **Chris Date principles**: Minimize nulls, eliminate redundancy
- **BCNF normalization**: Boyce-Codd Normal Form - third normal form with no transitive dependencies
- **Referential integrity**: All foreign keys with proper constraints
- **Manual migrations**: SQL files in `database/migrate/` folder

### Testing Strategy
- **No client-side unit tests**: All testing happens on the server side
- **Unit tests**: For utils and small utilities (`server/tests/unit/`)
- **Integration tests**: For all endpoints (`server/tests/integration/v3/`)
- **E2E tests**: Playwright tests for whole user flows (`server/tests/e2e/`)
- **Coverage target**: 80% for server

### Workflow
- **Make-based**: All commands via `make` from root directory
- **Database first**: Database starts first, then client/server in parallel
- **Backup-based**: Database restores from latest backup by default

## Docker Deployment

**Run all services:**
```bash
docker compose up --build -d
```

**Note**: All tests run locally using `make test` commands. No CI or Docker test setup. Default compose includes all runtime services (database, client, server, nginx, redis).

## Folder Structure

```bash
tree -I node_modules -I uploads -I history -I screenshots -I queries -I mutations
```
