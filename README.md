# GLOW - Graduate Learning Orientation Workshop

AI student profiles to help graduate teaching assistants learn.

## Overview

GLOW provides AI student profiles to assist graduate teaching assistants in their learning journey.

## Getting Started

### Docker Deployment
All components are deployable via Docker containers using the docker-compose file:

```bash
docker compose --profile dev up # dev
docker compose --profile prod up # prod
```

### Local Development

For local testing, you can run each component separately. Run the database command first to avoid any issues with types.:

**Database:**
```bash
cd database
bash run.sh --clean # fresh build
bash run.sh # use latest in history
```

**Frontend:**
```bash
cd client
yarn run dev
```

**Backend:**
```bash
cd server
make run
```



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
