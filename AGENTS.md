# Contributor Guide

## Dev Environment Tips

This monorepo uses a Makefile as the primary entrypoint for dev tasks across client, server, and database.

The easiest way to start everything is:

```bash
make dev
```
This will:
1. **Check and install all dependencies** (PostgreSQL, coturn, node, Python)
2. **Start the TURN/STUN server** (coturn, for WebRTC)
3. **Start the database** (with backup restore or clean init)
4. **Launch client and server** in parallel
5. **Display readiness status and URLs**

### Quick Start Targets

- `make dev` &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Start all services (interactive mode)
- `make dev-clean` &nbsp;: Start with fresh database (creates backup first)
- `make test` &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Run all test suites after startup
- `make detach` &nbsp;&nbsp;&nbsp;&nbsp;: Start services in background, exit shell
- `make dev-no-turn`: Start without TURN/STUN server
- `make help` &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Show Makefile help/usage

**For AI agents/automation**, use `make detach` for non-blocking startup.

---

## Manual Setup (Advanced)

If you wish to control the full stack manually or manage dependencies yourself, see below.

### Prerequisites (auto-managed by `make dev`)
- **PostgreSQL**
- **coturn** (TURN/STUN server for WebRTC)
- **Node.js** and Yarn (for client)
- **Python + uv** (for server)

### Install Only

```bash
make client-install     # installs yarn deps in client/
make server-sync        # installs Python deps in server/
make db-install         # installs yarn deps in database/
```
_You can also run individual package managers as before if preferred._

### Start Individual Services

```bash
make db                # Database (from latest backup)
make db-clean          # Wipe DB (auto-backup), clean start
make client            # Client dev server (Next.js)
make server            # Start API server (FastAPI)
```

---

## WebRTC & TURN Server

TURN/STUN server is **started automatically** on `make dev`. For management:

```bash
make turn            # Start TURN server
make turn-stop       # Stop TURN server
make turn-status     # Check TURN server status
make turn-test       # Test connectivity
```

**Docker TURN Server** (alternative):

```bash
docker compose up realtime -d      # Start TURN in Docker
docker compose logs realtime
```

### TURN Environment

The TURN server expects (auto-managed):

```bash
export TURN_PUBLIC_IP="your.public.ip"
export TURN_REALM="example.com"
export TURN_USERNAME="webrtc"
export TURN_PASS="auto_generated"
```

---

## WebRTC Testing

```bash
make turn-test
cd client && node scripts/test-webrtc-turn.js     # Manual
```
Or use the UI:  
1. Start: `make dev`
2. Open http://localhost:3000  
3. Test audio in a simulation.

---

### Troubleshooting

- **Slow audio?** TURN server may not be running.
- **Connection failed?** Check firewalls (UDP 3478, 49160-49200)
- **No audio?** Microphone permissions or browser settings.

Useful debug:

```bash
make turn-status
cd client && node scripts/test-webrtc-turn.js
cd server && tail -f logs/server.log | grep -i webrtc
```

---

## Testing Instructions

**All Tests** (Recommended):

```bash
make test         # All services + all tests
make detach-test  # Detached mode, run all tests (for CI/agents)
```

**Individual Suites**

- Client unit: `make client-test`
- Server unit: `make server-test`
- Database E2E (Cypress): `make db-test`

**Docker E2E**:

```bash
docker compose --profile test up --build
# Or run only
docker compose --profile test up testing
```

---

## Database Migrations

Behavior matches `make db` (default: restore from backup; clean: full wipe).

**Migrate:**
```bash
make db-generate    # Generate SQL migration files (from schema)
make db-migrate     # Apply pending migrations
make db-studio      # Open Drizzle Studio UI
make db             # Launch DB as usual
```

**Migration Workflow:**
1. Edit `client/drizzle/schema.ts`
2. `make db-generate`
3. Review `database/drizzle/`
4. `make db-migrate`
5. Restart services

---

## Typechecking

- `make client-typecheck` &nbsp;&nbsp;// client (tsc)
- `make server-typecheck` &nbsp;&nbsp;// server (mypy)

---

## Key Files & Folders

- `client/package.json` &nbsp;&nbsp;&nbsp;Client scripts/deps
- `client/drizzle/schema.ts` &nbsp;[DB schema source of truth]
- `database/migrations/` &nbsp;&nbsp;&nbsp;All migration files
- `database/init/` &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;DB initial modules
- `server/Makefile` &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Server commands
- `server/models.py` &nbsp;&nbsp;&nbsp;Server-side models

---

## Architecture

- **Database-First**: DB starts before client/server
- **Backup-Based**: DB restores from backup by default (no auto migrations)
- **Manual Migration**: Use `make db-generate` + `make db-migrate`
- **Clean Start**: Use `make db-clean` or `make dev-clean`
- **Detached Mode**: Use `make detach` for background services (automation)

---

## Docker Deployment

- Dev: `docker compose --profile dev up --build -d`
- Prod: `docker compose --profile prod up --build -d`

- Client test: `docker compose --profile test run --rm client-test`
- Server test: `docker compose --profile test run --rm server-test`
- DB E2E: `docker compose --profile test run --rm database-test`

---

## Folder Structure

```bash
tree -I node_modules -I uploads -I history -I screenshots -I queries -I mutations
```

