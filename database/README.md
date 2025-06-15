# Database Management

This directory contains all database-related operations for the Glow project. All Drizzle operations now run from this folder, with generated files automatically copied to the client.

## Workflow

### 1. Default Start (Latest Backup + Migrations)
```bash
npm run start
# or
yarn start
```
- Finds the latest backup from `history/` folder
- Restores the backup to a fresh database
- Applies any pending migrations using `npx drizzle-kit migrate`
- Generates and copies schema, types, queries, and mutations to client
- Keeps running until interrupted (creates backup on exit)

### 2. Clean Start (Fresh Database)
```bash
npm run start:clean
# or
yarn start:clean
```
- Creates a fresh database from `init.sql`
- Generates and copies schema, types, queries, and mutations to client
- Exits after setup is complete

### 3. Migration Mode (Generate New Migrations)
```bash
npm run migrate
# or
yarn migrate
```
- Starts with a clean database from `init.sql`
- Runs `npx drizzle-kit generate` to show interactive diff
- Generates migration files based on schema changes
- Does NOT automatically apply migrations (use default start for that)

### 4. Connect to Database
```bash
npm run connect
# or
yarn connect
```
- Opens an interactive psql session to the existing database

## File Generation

When any of the start commands run, the following files are automatically generated and copied to the client:

### Generated Files:
- **Schema**: `client/utils/drizzle/schema.ts` (cleaned version from `database/drizzle/schema.ts`)
- **Types**: `client/types.ts` (TypeScript types for all tables and enums)
- **Queries**: `client/utils/queries/[table]/` (GET operations for each table)
- **Mutations**: `client/utils/mutations/[table]/` (CREATE, UPDATE, DELETE operations)

### Manual Generation:
You can also run the generation scripts individually:
```bash
npm run generate:schema    # Clean and copy schema
npm run generate:types     # Generate TypeScript types
npm run generate:queries   # Generate queries and mutations
npm run generate:all       # Run all generation scripts
```

## Directory Structure

```
database/
├── drizzle/              # Drizzle files (schema, migrations, relations)
├── scripts/              # Generation scripts
├── history/              # Database backups (auto-created)
├── init.sql              # Initial database schema
├── start.sh              # Main database management script
├── drizzle.config.ts     # Drizzle configuration
└── package.json          # Database-specific dependencies
```

## Client Integration

The client no longer needs drizzle-kit or generation scripts. It simply uses:
- `@/utils/drizzle/schema` - Database schema
- `@/utils/drizzle/db` - Database connection
- `@/types` - TypeScript types
- `@/utils/queries/[table]/` - Query functions
- `@/utils/mutations/[table]/` - Mutation functions

## Backup System

- Backups are automatically created in `history/` folder with timestamp
- Backups are created:
  - Before any database operation
  - When the database process exits
- Latest backup is used when starting without `--clean` flag

## Environment Variables

Required environment variables:
- `DB_USER` - Database user (default: myuser)
- `DB_PASSWORD` - Database password (default: mypassword)
- `DB_NAME` - Database name (default: mydb)
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)

## Development Workflow

1. **Making Schema Changes**: Edit `database/drizzle/schema.ts`
2. **Generate Migrations**: Run `npm run migrate` to see changes and generate migration files
3. **Apply Changes**: Run `npm run start` to apply migrations and update client files
4. **Fresh Start**: Use `npm run start:clean` when you want to start completely fresh

## Notes

- All drizzle-kit operations run from the database folder
- Client automatically gets updated files when database starts
- Migration files are stored in `database/drizzle/`
- The system preserves data through backups during migrations 