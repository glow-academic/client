# GLOW - Graduate Learning Orientation Workshop

AI student profiles to help graduate teaching assistants learn.

## Overview

GLOW provides AI student profiles to assist graduate teaching assistants in their learning journey.

## Getting Started

### Quick Start (Recommended)

The easiest way to start the entire development environment:

```bash
bash run.sh
```

This automatically:
- Starts the database
- Starts client and server in parallel
- Handles database migrations
- Shows when everything is ready

**Options:**
```bash
bash run.sh --clean    # Clean database first
bash run.sh --test     # Run all tests after startup
bash run.sh --help     # Show help
```

### Prerequisites

Before running, ensure you have:
- **PostgreSQL** installed and running
- **Node.js & Yarn** for the client
- **Python & uv** for the server

**Install PostgreSQL:**
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# CentOS
sudo yum install postgresql-server postgresql-contrib
sudo systemctl start postgresql
```

### Docker Deployment
All components are deployable via Docker containers:
```bash
docker compose --profile dev up --build -d
docker compose --profile prod up --build -d
```

### Manual Development (Advanced)

If you need to run services individually:

**Database:**
```bash
cd database && yarn start        # normal start
cd database && yarn start:clean  # clean start
```

**Frontend:**
```bash
cd client && yarn dev
```

**Backend:**
```bash
cd server && make run
```

## Database Migrations

Migrations are handled automatically when using `bash run.sh`. When you modify the schema in `client/drizzle/schema.ts`, the system will:
- Generate migration files in `database/migrations/`
- Apply them to the database
- Continue gracefully if there are issues

## Testing

**All Tests:**
```bash
bash run.sh --test
```

**Individual Tests:**
```bash
cd client && yarn test          # Unit tests (vitest)
cd server && make test          # Unit tests (pytest)  
cd database && yarn test:cypress # E2E tests (cypress)
```

## Notes
- Each component should have corresponding test cases
- Each database table should have Cypress test coverage
- See `AGENTS.md` for detailed development guidelines

## Tech Stack

### Frontend
- **Hooks:** [React](https://react.dev/)
- **Caching:** [React Query](https://tanstack.com/query/latest)
- **Routing:** [Next.js](https://nextjs.org/)
- **UI Library:** [Shadcn](https://ui.shadcn.com/)
- **Styling:** [TailwindCSS](https://tailwindcss.com/)
- **Database Connection:** [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- **Linter:** [ESLint](https://eslint.org/)
- **Unit Tests:** [Vitest](https://vitest.dev/)
- **Integration Tests:** [Cypress](https://www.cypress.io/)

### Backend
- **Server:** [FastAPI](https://fastapi.tiangolo.com/)
- **Database Connection:** [SQLModel](https://sqlmodel.tiangolo.com/)
- **LLM:** [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- **Unit Tests:** [pytest](https://docs.pytest.org/en/stable/)
- **Typechecker:** [MyPy](https://mypy-lang.org/)
- **Linter:** [ruff](https://docs.astral.sh/ruff/)

### Database
- **SQL:** [PostgreSQL](https://www.postgresql.org/)
- **Migrations:** [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)
