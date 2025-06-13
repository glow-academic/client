# How to Properly Code For This Repository

## Quick Start

This is a monorepo with a client, database, and server. The easiest way to start everything is:

```bash
bash run.sh
```

This will automatically:
1. Start the database
2. Start the client and server in parallel  
3. Handle database migrations automatically
4. Show you when everything is ready

### Options

```bash
bash run.sh --clean    # Clean database before starting
bash run.sh --test     # Run all test suites after startup
bash run.sh --help     # Show help message
```

## Manual Setup (Advanced)

If you need to start services individually:

### Prerequisites
- PostgreSQL must be installed and running
- Node.js and Yarn for the client
- Python and uv for the server

### Database
```bash
cd database && yarn start
# or for clean start:
cd database && yarn start:clean
```

### Client
```bash
cd client && yarn dev
```

### Server
```bash
cd server && make run
```

## Tests

### All Tests (Recommended)
```bash
bash run.sh --test
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

**End-to-End Tests** (Cypress):
```bash
cd database && yarn test:cypress
# Note: All services must be running first
```

## Database Migrations

Migrations are now handled automatically! When you:
1. Modify `client/drizzle/schema.ts`
2. Run `bash run.sh`

The system will:
- Generate new migration files in `database/migrations/`
- Apply them to the database automatically
- Continue gracefully if there are any issues

### Manual Migration Commands

```bash
cd database && yarn generate    # Generate migrations
cd database && yarn migrate     # Apply migrations
cd database && yarn studio      # Open Drizzle Studio
```

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
- **Schema Sync**: Client schema changes automatically generate and apply migrations
- **Graceful Errors**: If migrations fail, the system continues with the current database state
- **Fresh Start**: Migration files start fresh (old ones were cleaned up)

## Folder Structure

```bash
tree -I node_modules -I uploads -I history -I screenshots
```
