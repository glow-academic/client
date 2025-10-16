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
make test-client # Run client tests
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
make start-db    # Start database
make migrate-db  # Run migrations
make fresh-db    # Fresh start (with backup)
```

## 🧪 Testing

**Run tests:**
```bash
make test          # Server unit tests
make test-client   # Client unit tests
make test-cov      # Server with coverage
```

**Individual tests:**
```bash
cd client && yarn test          # Frontend unit tests (vitest)
cd server && make test          # Backend unit tests (pytest)
cd client && yarn test:coverage # Frontend with coverage
cd server && make test-cov      # Backend with coverage
```

**Coverage Target**: 80% for both client and server

## 🐳 Docker

```bash
docker compose up --build -d                       # Run all services
docker compose --profile test run --rm client-unit # Client unit tests
docker compose --profile test run --rm server-unit # Server unit tests
```

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
- **State:** [TanStack Query](https://tanstack.com/query/latest)
- **Testing:** [Vitest](https://vitest.dev/)
- **Linter:** [ESLint](https://eslint.org/)

### Backend
- **Server:** [FastAPI](https://fastapi.tiangolo.com/)
- **Database:** [asyncpg](https://github.com/MagicStack/asyncpg) (raw SQL)
- **LLM:** [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- **Testing:** [pytest](https://docs.pytest.org/en/stable/)
- **Linter:** [Ruff](https://docs.astral.sh/ruff/)
- **Config:** [pyproject.toml](https://packaging.python.org/en/latest/specifications/pyproject-toml/)

### Database
- **SQL:** [PostgreSQL](https://www.postgresql.org/)
- **Migrations:** [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) (database folder only)

### Architecture
- **Client**: Fast/dumb UI - presentation only
- **Server**: All business logic in service layer
- **Database**: asyncpg (no ORM), BCNF normalization, no nulls
- **Testing**: Unit tests only (80% target), no integration/E2E yet
- **WebSocket**: Socket.IO with Redis for real-time features
