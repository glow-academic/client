# GLOW - Graduate Learning Orientation Workshop

AI student profiles to help graduate teaching assistants learn.

## Overview

GLOW provides AI student profiles to assist graduate teaching assistants in their learning journey.

## Getting Started

### Docker Deployment
All components are deployable via Docker containers using the docker-compose file:

bash
docker compose up --build -d

### Local Development

For local testing, you can run each component separately:

**Frontend:**
bash

yarn run dev


**Backend:**
bash

make run

**Database:**
bash

psql postgresql://myuser:mypassword@localhost:5432/mydb -f db/init.sql

## Tech Stack

### Frontend
- **Hooks:** [React](https://react.dev/)
- **Caching:** [React Query](https://tanstack.com/query/latest)
- **Routing:** [Next.js](https://nextjs.org/)
- **UI Library:** [Shadcn](https://ui.shadcn.com/)
- **Styling:** [TailwindCSS](https://tailwindcss.com/)
- **Database Connection:** [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- **Linter:** [ESLint](https://eslint.org/)
- **Unit Tests:** [Jest](https://jestjs.io/)
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