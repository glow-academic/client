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
make run         # Start all services (foreground, combined logs)
make stop        # Stop all services
make test        # Run server unit tests (pytest)
make test-client # Run client unit tests (vitest)
make test-cov    # Server tests with coverage
make test-client-cov # Client tests with coverage
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
make start-db    # Start database (latest backup)
make fresh-db    # Fresh database (backup first, then init.sql)
make migrate-db  # Apply pending migrations
make connect-db  # Connect to database shell
```

## Testing Instructions

### All Tests (Unit Tests)
```bash
make test          # Server unit tests (pytest)
make test-client   # Client unit tests (vitest)
make test-cov      # Server tests with coverage
cd client && yarn test:coverage  # Client tests with coverage
```

**Testing Strategy**: 
- Focus on comprehensive unit testing (80% coverage target)
- No E2E tests until unit test coverage is established
- Test pyramid: strong unit test foundation first

### Individual Test Suites

**Client Unit Tests** (vitest):
```bash
cd client && yarn test           # Run all tests
cd client && yarn test:watch     # Watch mode
cd client && yarn test:coverage  # With coverage report
```

**Server Unit Tests** (pytest):
```bash
cd server && make test                    # Run all tests  
cd server && make test-cov                # With coverage report
make test server/tests/test_specific.py   # Run specific file
```

### Coverage Reports
- **Server**: HTML report in `server/htmlcov/index.html`
- **Client**: HTML report in `client/coverage/index.html`
- **Target**: 80% coverage for both client and server

## Database Migrations

### Migration Commands

```bash
make migrate-db  # Apply pending migrations
cd database && yarn drizzle:generate  # Generate new migration
cd database && yarn drizzle:studio    # Visual schema explorer
```

### Migration Workflow
1. Make schema changes in `database/drizzle/` SQL files
2. Generate migration: `cd database && yarn drizzle:generate`
3. Review generated migration in `database/drizzle/`
4. Apply migration: `make migrate-db`
5. Restart services: `make stop && make run`

**Note**: Drizzle is used exclusively in `database/` folder for migrations. Server uses asyncpg for all database operations.

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
- `client/app/api/` - BFF (Backend for Frontend) API routes
- `client/components/` - React components (fast/dumb UI)

### Database  
- `database/drizzle/` - Migration files (Drizzle for migrations only)
- `database/seed/` - Seed data scripts

### Server
- `server/app/queries/` - Raw SQL queries (asyncpg)
- `server/app/services/` - Business logic layer
- `server/app/repositories/` - Data access layer
- `server/app/api/` - FastAPI routes

## Architecture Principles

### Client: Fast & Dumb UI
- **Presentation only**: Components focus on rendering and user interactions
- **No business logic**: All validation, processing on server
- **State management**: TanStack Query for server state, minimal local state
- **Testing**: Unit tests with Vitest (80% coverage target)

### Server: All Business Logic
- **Service layer**: All complex logic in `app/services/`
- **Repository pattern**: Data access abstracted in `app/repositories/`
- **No ORM**: Raw SQL with asyncpg in `app/queries/`
- **Testing**: Unit tests with pytest (80% coverage target)

### Database: BCNF & No Nulls
- **Chris Date principles**: Minimize nulls, eliminate redundancy
- **BCNF normalization**: Third normal form with no transitive dependencies
- **Referential integrity**: All foreign keys with proper constraints
- **Drizzle for migrations only**: Used exclusively in `database/` folder

### Testing Strategy
- **Unit tests first**: 80% coverage target before integration/E2E
- **No E2E yet**: Focus on comprehensive unit testing foundation
- **Test pyramid**: Strong unit test base, then integration, then E2E

### Workflow
- **Make-based**: All commands via `make` from root directory
- **Database first**: Database starts first, then client/server in parallel
- **Backup-based**: Database restores from latest backup by default

## Docker Deployment

**Run all services:**
```bash
docker compose up --build -d
```

**Run unit tests:**
```bash
docker compose --profile test run --rm client-unit   # Client unit tests (Vitest)
docker compose --profile test run --rm server-unit   # Server unit tests (pytest)
```

**Note**: Only 'test' profile exists. Default compose includes all runtime services (database, client, server, nginx, redis).

## Folder Structure

```bash
tree -I node_modules -I uploads -I history -I screenshots -I queries -I mutations
```
