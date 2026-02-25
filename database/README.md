# Database Management

This directory contains all database-related operations for the Glow project.

## Source of Truth

- **Schema**: `schema.sql` — auto-updated by `make migrate-db` (pg_dump after each migration)
- **Seed data**: `modules/` — static SQL files, hand-maintained (see `modules/README.md`)
- **Migrations**: `migrate/` — incremental DDL changes

## Workflow

### 1. Default Start (Latest Backup)
```bash
make restore-db
```
- Finds the latest backup from `history/` folder
- Restores the backup to a fresh database

### 2. Fresh Start (Interactive Setup)
```bash
make fresh-db
```

This runs an interactive setup that:
1. Prompts for configuration (NODE_ENV, PORT, ORIGIN, APP_PREFIX)
2. Asks for institution type (organization or university)
3. Configures color scheme, auth providers, AI providers
4. Generates a timestamped seed file in `database/seeds/`

### 3. Seed from Modules (YAML Config)
```bash
make build-test-seed              # Build test-seed.sql from modules
make seed-from-yaml               # Load seed data directly into database
make seed-from-yaml CONFIG=my.yaml  # Use custom YAML config
```

### 4. Migration Mode
```bash
make migrate-db       # Apply + regenerate schema.sql + test-schema.sql
make migrate-db-only  # Apply only, no regeneration
```

### 5. Connect to Database
```bash
make connect-db
```

## Directory Structure

```
database/
├── schema.sql              # DDL schema (auto-generated from live DB)
├── test-seed.sql           # Test seed (generated from modules via YAML)
├── scripts/
│   ├── load-modules.sh     # YAML config → assembled seed SQL
│   ├── start.sh            # Database management (start/migrate/backup)
│   ├── setup-fresh-db.sh   # Interactive fresh database setup
│   ├── generate-test-schema.sh
│   └── encrypt-keys.js     # API key encryption utility
├── modules/                # Static seed data modules (see modules/README.md)
├── configs/                # YAML configs for module selection
├── migrate/                # Migration SQL files
├── seeds/                  # Timestamped seed files (from fresh-db)
├── history/                # Database backups (auto-created)
└── package.json
```

## Migration Workflow

1. Find next migration number: `ls database/migrate/ | sort -n | tail -1`
2. Create migration file: `database/migrate/{next_number}_{desc}.sql`
3. Apply: `make migrate-db` (auto-updates schema.sql + test-schema.sql)
4. If seed data changed, update the relevant module file in `modules/`
5. Run `make build-test-seed` to rebuild test seed

## Environment Variables

- `DB_USER` — Database user (default: myuser)
- `DB_PASSWORD` — Database password (default: mypassword)
- `DB_NAME` — Database name (default: mydb)
- `DB_HOST` — Database host (default: localhost)
- `DB_PORT` — Database port (default: 5432)
- `SECRET_KEY` — Required for encrypting API keys and secrets
