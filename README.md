# GLOW
Graduate Learning Orientation Workshop


AI student profiles, to help graduate teaching assistants learn.


Tech Stack
All deployable via docker containers, via docker-compose file. 

Run 'docker compose up --build -d' to start all.
For pure local testing,

Client: 'yarn run dev'
Server: 'make run'
Database: 'psql postgresql://myuser:mypassword@localhost:5432/mydb -f db/init.sql'

Frontend
Hooks -- React, https://react.dev/
Caching -- React Query, https://tanstack.com/query/latest
Routing -- Next.js, https://nextjs.org/
UI Library -- Shadcn, https://ui.shadcn.com/
Styling -- TailwindCSS, https://tailwindcss.com/
Databse connection -- Drizzle ORM, https://orm.drizzle.team/docs/overview
Linter -- ESLint, https://eslint.org/
Unit tests -- Jest, https://jestjs.io/
Integration tests -- Cypress, https://www.cypress.io/

Backend
Server -- FastAPI, https://fastapi.tiangolo.com/
Database connection -- SQLModel, https://sqlmodel.tiangolo.com/
LLM -- OpenAI Agents SDK, https://openai.github.io/openai-agents-python/
Unit tests -- pytest, https://docs.pytest.org/en/stable/
Typechecker -- MyPy, https://mypy-lang.org/
Linter -- ruff, https://docs.astral.sh/ruff/

Database
SQL -- PostgreSQL, https://www.postgresql.org/

