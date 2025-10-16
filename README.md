# GLOW - Graduate Learning Orientation Workshop

AI student profiles to help graduate teaching assistants learn.

## 🚀 Quick Start

**Just run one command and everything works:**

```bash
bash run.sh
```

That's it! This automatically:
- ✅ **Installs all dependencies** (PostgreSQL, coturn, Node.js packages, Python packages)
- ✅ **Starts TURN/STUN server** (for WebRTC audio streaming)
- ✅ **Starts the database** (from your latest backup)
- ✅ **Starts the web app** (client + server)
- ✅ **Shows you when ready** (with URLs to visit)

### Options

```bash
bash run.sh --clean    # Start fresh (creates backup first)
bash run.sh --test     # Run all tests after startup
bash run.sh --detach   # Run in background (for automation)
bash run.sh --no-turn  # Skip TURN server (use external/Docker)
bash run.sh --help     # Show all options
```

## 🔧 What Gets Installed Automatically

The `run.sh` script will automatically install:

- **PostgreSQL** (via brew on macOS, apt on Ubuntu, yum on CentOS)
- **coturn** (TURN/STUN server for WebRTC, via brew/apt/yum or Docker)
- **Client dependencies** (Node.js packages via yarn)
- **Server dependencies** (Python packages via uv/pip)
- **Database tools** (Drizzle, Cypress, etc.)

**No manual setup required!** Just run `bash run.sh` and start coding.

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

If you prefer Docker over local development:
```bash
docker compose --profile test build         # runs Vitest & PyTest
docker compose build client server          # fast – cache is hot
docker compose build database               # you can prune cache
docker compose up -d
```

## 📚 Advanced Usage

For detailed development guidelines, database migrations, and advanced configuration, see [`AGENTS.md`](./AGENTS.md).

**Manual service control** (if needed):
```bash
cd database && yarn start        # Database only
cd client && yarn dev            # Frontend only  
cd server && make run            # Backend only
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
- **Unit Tests:** [Vitest](https://vitest.dev/)

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
