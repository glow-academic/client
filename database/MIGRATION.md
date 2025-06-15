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
2. **Clean Schema**: Drops the existing database and creates a fresh one with the latest schema from `init/`
3. **Apply Migrations**: Runs any pending Drizzle migrations from the `migrations/` folder
4. **Data Restoration**: Attempts to restore your data from the backup, handling schema conflicts gracefully

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

### Data Not Restored
If some data isn't restored after migration:
1. Check the migration output for warnings
2. Look at backup files in `history/` folder
3. Manually restore specific data if needed

### Migration Fails
If migration fails completely:
1. Check PostgreSQL logs for errors
2. Verify your `init/` files are valid SQL
3. Use `yarn start:clean` to start fresh if needed

### Rollback
To rollback a migration:
1. Find your backup in `history/` folder
2. Use `yarn start:clean` to create fresh database
3. Manually restore: `psql "your_connection_string" -f history/backup_TIMESTAMP.sql`

## Example Workflow

```bash
# 1. Make changes to init/ folder
# 2. Run migration
yarn start:migrate

# 3. Check your data
yarn connect

# 4. If something went wrong, rollback
yarn start:clean
# Then manually restore from history/backup_TIMESTAMP.sql
``` 