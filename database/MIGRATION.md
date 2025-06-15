# Database Migration Guide

## Migration Commands

When you've made changes to your `init/` folder and need to update your database schema while preserving existing data, use these migration commands:

### Available Commands

```bash
# Start database with migration (applies new schema + restores data)
yarn start:migrate

# Connect to database with migration
yarn connect:migrate
```

## How Migration Works

1. **Backup Creation**: If your current database has data, it creates an automatic backup
2. **Interactive Prompt**: Asks if you want to generate new migrations from schema changes
3. **Schema Generation**: Optionally runs `npx drizzle-kit generate` to create new migrations
4. **Clean Database**: Drops the existing database and creates a fresh one
5. **Apply Migrations**: Uses `npx drizzle-kit migrate` to apply all migrations properly
6. **Fallback Support**: Falls back to `init/` files if Drizzle migrations fail
7. **Data Restoration**: Attempts to restore your data from the backup, handling schema conflicts gracefully

## When to Use Migration

Use migration when:
- ✅ You've modified files in the `init/` folder
- ✅ You want to preserve existing data
- ✅ You're ready to handle potential data compatibility issues

Use clean start instead when:
- ✅ You want to start completely fresh (use `yarn start:clean`)
- ✅ You don't need to preserve existing data
- ✅ You're in early development and data loss is acceptable

## Migration Safety

- **Automatic Backups**: Every migration creates a timestamped backup in `history/`
- **Graceful Failures**: If some data can't be restored due to schema changes, the process continues
- **Selective Restoration**: Attempts multiple restoration strategies for maximum data recovery
- **Manual Rollback**: You can manually restore from backups if needed

## Common Migration Scenarios

### ✅ Safe Migrations
- Adding new tables
- Adding new optional columns (with defaults)
- Adding new indexes
- Modifying column comments

### ⚠️ Potentially Lossy Migrations
- Removing tables or columns
- Changing column types
- Adding required columns without defaults
- Adding new constraints

## Troubleshooting

### Common Errors

#### "column specified more than once"
This error occurs when there are duplicate column definitions in your SQL files:
1. Check your `init/` files for duplicate column names
2. Ensure each column is only defined once per table
3. Look for conflicts between different init modules

#### Schema Generation Fails
If the client schema cleanup/generation fails:
1. Check that your TypeScript schema compiles correctly
2. Run `cd client && npx drizzle-kit generate` manually to see specific errors
3. Fix any TypeScript compilation issues in your schema files

### Data Not Restored
If some data isn't restored after migration:
1. Check the migration output for warnings
2. Look at backup files in `history/` folder
3. Manually restore specific data if needed

### Migration Fails
If migration fails completely:
1. **Schema Issues**: Check for duplicate column definitions, syntax errors in `init/` files
2. **Client Schema**: Ensure your client-side schema compiles correctly
3. **PostgreSQL Issues**: Check PostgreSQL logs for database-level errors
4. **Recovery**: Use `yarn start:clean` to start fresh, then manually restore from `history/` backups

### Rollback
To rollback a migration:
1. Find your backup in `history/` folder
2. Use `yarn start:clean` to create fresh database
3. Manually restore: `psql "your_connection_string" -f history/backup_TIMESTAMP.sql`

## Example Workflow

```bash
# 1. Make changes to your schema files in client/
# 2. Run migration
yarn start:migrate

# 3. When prompted, choose 'y' to generate new migrations if you have schema changes
# 4. The system will use drizzle-kit migrate to apply changes properly
# 5. Check your data
yarn connect

# 6. If something went wrong, rollback
yarn start:clean
# Then manually restore from history/backup_TIMESTAMP.sql
```

## Key Benefits

- **Uses Drizzle's Migration System**: Leverages `drizzle-kit migrate` for proper migration tracking
- **Interactive Control**: You decide when to generate new migrations
- **Proper Migration Tracking**: Drizzle maintains a `__drizzle_migrations` table to track applied migrations
- **Fallback Safety**: Falls back to `init/` files if Drizzle migrations fail
- **No Client Dependencies**: Runs independently from the database directory 