# GLOW - Graduate Learning Orientation Workshop

AI student profiles to help graduate teaching assistants learn.

## 🚀 Quick Start

Start all services with one command:

```bash
make run
```

This starts database, client, and server with color-coded logs. Press Ctrl+C to stop.

### Common Commands

```bash
make run         # Start all services
make stop        # Stop all services  
make test        # Run server tests
make help        # Show all commands
```

## 🔧 Setup

**Install dependencies:**
```bash
make setup           # Create Python virtual environment
make install         # Install Python dependencies (from pyproject.toml)
make install-client  # Install client dependencies (yarn)
```

**Database setup:**
```bash
make restore-db     # Restore database from latest backup
make migrate-db     # Run migrations
make fresh-db       # Interactive setup for fresh database (generates timestamped seed file)
make export-db      # Export database (schema|base|university|organization)
```

## 🧪 Testing

**Run tests:**
```bash
make test          # Run all server tests (unit + integration)
make test-unit     # Unit tests for utils and utilities (no setup needed)
make test-integration  # Integration tests for all endpoints (no setup needed)
make test-cov      # Server tests with coverage
```

**End-to-end tests (requires test services running):**
```bash
make run-test      # Start all services in TEST mode (required first)
make test-e2e      # Run E2E tests with Playwright (headless)
make test-e2e-headed  # Run E2E tests with browser visible
```

**Individual test suites:**
```bash
make test-unit                    # Unit tests (server/tests/unit/) - no setup needed
make test-integration             # Integration tests (server/tests/integration/) - no setup needed
make test server/tests/test_specific.py  # Run specific test file
```

**Coverage Target**: 80% for server

## 🐳 Docker

```bash
docker compose up --build -d  # Run all services
```

**Note**: Tests run locally using `make test` commands. No CI/Docker test setup.

## 📚 Advanced Usage

See [`AGENTS.md`](./AGENTS.md) for detailed documentation.

**Quick reference:**
```bash
make help        # Show all available commands
make format      # Format code (Ruff)
make lint        # Run linters
make typecheck   # Type check server (MyPy)
```

## Tech Stack

### Frontend
- **Framework:** [Next.js 15](https://nextjs.org/) with App Router
- **UI:** [React 19](https://react.dev/) + [Shadcn](https://ui.shadcn.com/)
- **Styling:** [TailwindCSS](https://tailwindcss.com/)
- **Server Actions:** Next.js server actions (`"use server"`) for all backend communication
- **Linter:** [ESLint](https://eslint.org/)

### Backend
- **Server:** [FastAPI](https://fastapi.tiangolo.com/)
- **Database:** [asyncpg](https://github.com/MagicStack/asyncpg) (raw SQL)
- **Architecture:** DHH-style - 1 SQL file per route, 1 Python file per route
- **LLM:** [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- **Testing:** [pytest](https://docs.pytest.org/en/stable/) + [Playwright](https://playwright.dev/) for E2E
- **Linter:** [Ruff](https://docs.astral.sh/ruff/)
- **Config:** [pyproject.toml](https://packaging.python.org/en/latest/specifications/pyproject-toml/)

### Database
- **SQL:** [PostgreSQL](https://www.postgresql.org/)
- **Migrations:** Manual SQL files in `database/migrate/` folder
- **Seeding:** Database-first approach - database is source of truth, seed files generated from live database

### Architecture
- **Client**: Airgapped UI - server actions dominate, presentation only
- **Server**: DHH-style architecture - 1 SQL file per route, 1 Python file per route, no abstraction layers
- **Database**: asyncpg (no ORM), BCNF normalization, no nulls (Chris Date principles)
- **Testing**: Unit tests (utils), integration tests (endpoints), E2E tests (Playwright)
- **WebSocket**: Socket.IO with Redis for real-time features
