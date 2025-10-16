# Contributor Guide

## Dev Environment Tips

This is a monorepo with a client, database, and server. The easiest way to start everything is:

```bash
bash run.sh
```

This will automatically:
1. **Check and install dependencies** (PostgreSQL, coturn, Node.js packages, Python packages)
2. **Start the TURN/STUN server** (coturn) for WebRTC connectivity
3. **Start the database** (from latest backup)
4. **Start the client and server** in parallel  
5. **Show you when everything is ready**

**Zero-setup experience**: Just run `bash run.sh` and everything will be installed and configured automatically.

### Quick Start Options

```bash
bash run.sh                # Start all services (interactive mode)
bash run.sh --clean        # Start with fresh database (creates backup first)
bash run.sh --test         # Run all test suites after startup
bash run.sh --detach       # Start services in background, script exits
bash run.sh --no-turn      # Skip TURN/STUN server startup
bash run.sh --clean --test # Clean start + run tests
bash run.sh --help         # Show help message
```

**For AI agents/automation**, use `--detach` to avoid blocking the terminal:
```bash
bash run.sh --detach       # Services run in background, terminal is freed
```

## Manual Setup (Advanced)

If you need to start services individually or install dependencies manually:

### Prerequisites (Auto-installed by `run.sh`)
- **PostgreSQL** (auto-installed via brew/apt/yum)
- **coturn** (TURN/STUN server for WebRTC, auto-installed via brew/apt/yum or Docker)
- **Node.js and Yarn** for the client (dependencies auto-installed)
- **Python and uv** for the server (dependencies auto-installed)

### Manual Dependency Installation
```bash
# Client dependencies
cd client && yarn install

# Server dependencies  
cd server && make sync
# or: uv pip install -r requirements.txt
# or: pip install -r requirements.txt

# Database dependencies
cd database && yarn install
```

### Manual Service Startup
```bash
# Database
cd database && yarn start          # Start with latest backup
cd database && yarn start --clean  # Clean start (backup first)

# Client
cd client && yarn dev

# Server
cd server && make run
```

## WebRTC & TURN Server

The application includes WebRTC functionality for real-time audio streaming. A TURN/STUN server (coturn) is automatically started for reliable connectivity.

### TURN Server Management

**Automatic Setup** (recommended):
```bash
bash run.sh                    # Starts TURN server automatically
bash run.sh --no-turn          # Skip TURN server startup
```

**Manual TURN Server Setup**:
```bash
bash realtime/setup.sh          # Setup and start TURN server
bash realtime/setup.sh status   # Check TURN server status
bash realtime/setup.sh stop     # Stop TURN server
bash realtime/setup.sh test     # Test TURN server connectivity
```

**Docker TURN Server** (alternative):
```bash
docker compose up realtime -d      # Start TURN server in Docker
docker compose logs realtime       # Check TURN server logs
```

### Environment Variables

The TURN server requires these environment variables (auto-configured):

```bash
export TURN_PUBLIC_IP="your.public.ip"    # Auto-detected
export TURN_REALM="example.com"           # Default realm
export TURN_USERNAME="webrtc"             # Default username
export TURN_PASS="generated_password"     # Auto-generated
```

### WebRTC Testing

**Test TURN Server Connectivity**:
```bash
cd client && node scripts/test-webrtc-turn.js
```

**Test WebRTC in Browser**:
1. Start services: `bash run.sh`
2. Open http://localhost:3000
3. Navigate to a simulation with audio features
4. Test microphone functionality

### Troubleshooting WebRTC

**Common Issues:**
- **Slow audio startup**: Ensure TURN server is running and accessible
- **Connection failures**: Check firewall allows UDP traffic on ports 3478 and 49160-49200
- **No audio detected**: Verify microphone permissions in browser

**Debug Commands:**
```bash
# Check TURN server status
bash realtime/setup.sh status

# Test connectivity
cd client && node scripts/test-webrtc-turn.js

# Check server logs for WebRTC errors
cd server && tail -f logs/server.log | grep -i webrtc
```

**Network Requirements:**
- Port 3478 (UDP/TCP): STUN/TURN server
- Ports 49160-49200 (UDP): TURN relay ports

## Testing Instructions

### All Tests (Recommended)
```bash
bash run.sh --test                    # Interactive mode with tests
bash run.sh --detach --test           # Detached mode with tests (for automation)
```

### Individual Test Suites

**Client Unit Tests** (vitest):
```bash
cd client && yarn test
```

**Server Unit Tests** (pytest):
```bash
cd server && make test
```

**Database E2E Tests** (Cypress):
```bash
cd database && yarn test
# Note: All services must be running first
# Tests database operations end-to-end via API calls
```

### Docker E2E Testing
```bash
# Start all services and run E2E tests in containers
docker compose --profile test up --build

# Or run tests against already running services
docker compose --profile dev up -d        # Start dev services
docker compose --profile test up testing  # Run E2E tests only
```

## Database Migrations

Database behavior follows the same logic as `yarn start` in the database folder:

- **Default**: Restores from latest backup (no automatic migrations)
- **Clean mode**: Creates backup first, then starts fresh from `init.sql`

### Manual Migration Commands

```bash
cd database && yarn generate    # Generate migrations from schema changes
cd database && yarn migrate     # Apply pending migrations  
cd database && yarn studio      # Open Drizzle Studio
cd database && yarn start       # Start with latest backup
cd database && yarn start --clean  # Clean start (backup first)
```

### Migration Workflow
1. Modify `client/drizzle/schema.ts` (source of truth)
2. Generate migrations: `cd database && yarn generate`
3. Review generated migration files in `database/drizzle/`
4. Apply migrations: `cd database && yarn migrate`
5. Restart services to use updated schema

## Typechecking

**Client:**
```bash
cd client && npx tsc --noEmit
```

**Server:**
```bash
cd server && make typecheck
```

## Key Files & Folders

### Client
- `client/package.json` - Dependencies and scripts
- `client/drizzle/schema.ts` - **Source of truth** for database schema

### Database  
- `database/migrations/` - All migration files (auto-generated)
- `database/init/` - Initial database setup modules

### Server
- `server/Makefile` - Server commands and setup
- `server/models.py` - Server-side models (generated from schema)

## Architecture Notes

- **Database First**: The database starts first, then client/server in parallel
- **Backup-Based**: Database restores from latest backup by default (no auto-migrations)
- **Manual Migrations**: Schema changes require manual migration generation and application
- **Clean Start**: `--clean` flag creates backup first, then starts fresh from `init.sql`
- **Detached Mode**: `--detach` flag runs services in background for automation/AI agents

## Docker Deployment

**Development Environment:**
```bash
docker compose --profile dev up --build -d
```

**Production Environment:**
```bash
docker compose --profile prod up --build -d
```

**Individual Test Services:**
```bash
docker compose --profile test run --rm client-test      # Client unit tests
docker compose --profile test run --rm server-test      # Server unit tests  
docker compose --profile test run --rm database-test    # Database E2E tests
```

## Folder Structure

```bash
tree -I node_modules -I uploads -I history -I screenshots -I queries -I mutations
```
