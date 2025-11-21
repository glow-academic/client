# Database Management

This directory contains all database-related operations for the Glow project. Migrations are managed manually using SQL files in the `migrate/` folder.

## Workflow

### 1. Default Start (Latest Backup + Migrations)
```bash
npm run start
# or
yarn start
```
- Finds the latest backup from `history/` folder
- Restores the backup to a fresh database
- Applies any pending migrations from `migrate/` folder
- Keeps running until interrupted (creates backup on exit)

### 2. Clean Start (Fresh Database)
```bash
npm run start:clean
# or
yarn start:clean
```
- Creates a fresh database from `app/init.sql`
- Generates all seed data
- Exits after setup is complete

### 3. Migration Mode (Apply Manual Migrations)
```bash
npm run migrate
# or
yarn migrate
```
- Applies all migration files from `migrate/` folder to the existing database
- Migration files are applied in alphabetical order

### 4. Connect to Database
```bash
npm run connect
# or
yarn connect
```
- Opens an interactive psql session to the existing database

## Directory Structure

```
database/
├── app/                 # Schema definitions (SQL files)
│   ├── init.sql        # Master initialization script
│   └── [module]/       # Module-specific schema files
├── migrate/            # Manual migration SQL files
├── seed/               # Seed data generation scripts
├── scripts/            # Database management scripts
├── history/            # Database backups (auto-created)
└── package.json        # Database-specific dependencies
```

## Migration Workflow

1. **Create Migration File**: Create a new SQL file in `migrate/` folder (e.g., `migrate/1_add_new_table.sql`)
2. **Write Migration SQL**: Use `DO $$ BEGIN ... END $$` blocks for conditional DDL
3. **Apply Migration**: Run `yarn migrate` or `make migrate-db` to apply migrations
4. **Restart Services**: Restart services to pick up schema changes

## Backup System

- Backups are automatically created in `history/` folder with timestamp
- Backups are created:
  - Before any database operation (in clean mode)
  - When the database process exits (in clean mode)
- Latest backup is used when starting without `--clean` flag

## Environment Variables

Required environment variables:
- `DB_USER` - Database user (default: myuser)
- `DB_PASSWORD` - Database password (default: mypassword)
- `DB_NAME` - Database name (default: mydb)
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)

## Development Workflow

1. **Making Schema Changes**: Edit SQL files in `app/` folder
2. **Create Migration**: Create a new migration file in `migrate/` folder for existing databases
3. **Apply Changes**: Run `yarn start` to apply migrations and restore data
4. **Fresh Start**: Use `yarn start:clean` when you want to start completely fresh

## Notes

- All migrations are manual SQL files in `migrate/` folder
- Migration files are applied in alphabetical order
- The system preserves data through backups during migrations 
- Server uses asyncpg for all database operations
