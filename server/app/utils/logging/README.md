# Database-Backed Logging Migration Guide

## Overview

This guide explains how to migrate all loggers in the codebase to use the centralized database-backed logging system. The system automatically writes logs to both console and database, with proper module-based logger names and profile_id tracking.

## Current Status

- ✅ Centralized logger utility: `server/app/utils/logging/db_logger.py`
- ✅ Database logging middleware: `server/app/middleware/db_logging.py` (auto-logs all requests)
- ✅ Database schema: `app_logs` table with simplified structure
- ⚠️ **Migration needed**: ~65 files still use `logging.getLogger()` directly

## Architecture

### Logger Setup

The centralized logger is initialized in `server/app/main.py` during application startup:

```python
from app.utils.logging.db_logger import setup_db_logger

# In lifespan startup:
setup_db_logger(db_pool)
```

### Logger Usage

**Before (Old Pattern):**
```python
import logging

logger = logging.getLogger(__name__)
logger.info("Something happened")
```

**After (New Pattern):**
```python
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)
logger.info("Something happened")
```

That's it! The logger automatically:
- Uses module name as `logger_name` (e.g., "app.api.v3.profile.detail")
- Writes to both console and database
- Extracts `profile_id` from context when available
- Resolves "guest-profile-id" to actual UUID (Chris Date: No Nulls)

## Migration Steps

### Step 1: Replace Logger Imports

**Find:**
```python
import logging

logger = logging.getLogger(__name__)
```

**Replace with:**
```python
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)
```

### Step 2: Remove Redundant Logger Configuration

If you see code like:
```python
logger.setLevel(logging.INFO)
logger.addHandler(...)
```

**Remove it** - the centralized logger handles all configuration.

### Step 3: Update Logger Calls (Optional)

Logger calls (`logger.info()`, `logger.error()`, etc.) work the same way. However, you can now add extra context:

```python
# Simple logging (works as before)
logger.info("User logged in")

# With extra context (stored in 'extra' JSONB column)
logger.info("User action", extra={"extra_data": {"action": "login", "ip": "1.2.3.4"}})
```

## Files to Migrate

Based on codebase scan, the following files need migration:

### API Routes (~15 files)
- `server/app/api/v3/profile/context.py`
- `server/app/api/v3/documents/upload_finalize.py`
- `server/app/api/v3/reports/export.py`
- `server/app/api/v3/attempts/bulk_archive.py`
- `server/app/api/v3/scenarios/select_attributes.py`
- `server/app/api/v3/scenarios/randomize.py`
- `server/app/api/v3/documents/certificate.py`
- ... (and others)

### Socket Handlers (~15 files)
- `server/app/socket/assistants/send_message.py`
- `server/app/socket/assistants/start.py`
- `server/app/socket/assistants/stop.py`
- `server/app/socket/simulations/send_message.py`
- `server/app/socket/simulations/start.py`
- `server/app/socket/simulations/stop.py`
- `server/app/socket/connections/connect.py`
- `server/app/socket/connections/disconnect.py`
- ... (and others)

### Utilities (~35 files)
- `server/app/utils/cache/*.py` (3 files)
- `server/app/utils/websocket/*.py` (20+ files)
- `server/app/utils/agents/*.py` (10+ files)
- `server/app/utils/error/log_and_raise_error.py`
- `server/app/utils/scenario/generate_problem_statement.py`
- ... (and others)

## Migration Checklist

For each file:

- [ ] Replace `import logging` + `logging.getLogger(__name__)` with `from app.utils.logging.db_logger import get_logger` + `get_logger(__name__)`
- [ ] Remove any `logger.setLevel()` calls
- [ ] Remove any `logger.addHandler()` calls
- [ ] Remove any custom formatters (handled centrally)
- [ ] Test that logs appear in database: `SELECT * FROM app_logs WHERE logger_name LIKE 'app.your.module%'`

## Best Practices

### 1. Always Use Module Name
```python
# ✅ Good
logger = get_logger(__name__)

# ❌ Bad - loses module context
logger = get_logger("custom_name")
```

### 2. Use Appropriate Log Levels
```python
logger.debug("Detailed debugging info")  # Development only
logger.info("Normal operation")          # General info
logger.warning("Something unexpected")   # Warning but not error
logger.error("Error occurred")           # Error that needs attention
```

### 3. Add Context with Extra Data
```python
# For structured logging
logger.error(
    "Failed to process request",
    extra={
        "extra_data": {
            "request_id": request_id,
            "user_id": user_id,
            "error_code": "PROCESSING_FAILED"
        }
    }
)
```

### 4. Profile ID Context
The middleware automatically sets `profile_id` in context for request logs. For background tasks or non-request contexts:

```python
from app.utils.logging.db_logger import set_profile_id

# Set profile context
set_profile_id("some-profile-id")
logger.info("Background task started")
# Clear when done
set_profile_id(None)
```

## Database Schema

Logs are stored in `app_logs` table:

```sql
CREATE TABLE app_logs (
  id          bigserial PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  level       text NOT NULL,                    -- 'debug' | 'info' | 'warn' | 'error'
  logger_name text NOT NULL,                    -- Module name (e.g., "app.api.v3.profile.detail")
  message     text NOT NULL,                    -- Log message
  profile_id  UUID NOT NULL REFERENCES profiles(id),  -- Always resolved (no nulls)
  extra       jsonb                             -- Additional context data
);
```

## Querying Logs

### Recent logs by module
```sql
SELECT ts, level, message, profile_id
FROM app_logs
WHERE logger_name = 'app.api.v3.profile.detail'
ORDER BY ts DESC
LIMIT 100;
```

### Errors in last hour
```sql
SELECT logger_name, COUNT(*) as error_count
FROM app_logs
WHERE level = 'error'
  AND ts > now() - interval '1 hour'
GROUP BY logger_name
ORDER BY error_count DESC;
```

### Logs by profile
```sql
SELECT ts, logger_name, level, message
FROM app_logs
WHERE profile_id = 'some-uuid-here'
ORDER BY ts DESC;
```

## Testing Migration

After migrating a file:

1. **Check console output** - logs should still appear in console
2. **Check database**:
   ```sql
   SELECT * FROM app_logs 
   WHERE logger_name LIKE 'app.your.module%' 
   ORDER BY ts DESC LIMIT 10;
   ```
3. **Verify logger_name** - should match module path (e.g., `app.api.v3.profile.detail`)

## Troubleshooting

### Logs not appearing in database
- Check that `setup_db_logger()` was called in `main.py` lifespan
- Verify database connection pool is initialized
- Check for exceptions in application logs

### Wrong logger_name
- Ensure using `get_logger(__name__)` not `get_logger("custom")`
- Module name is automatically derived from `__name__`

### Missing profile_id
- Request logs: middleware automatically sets profile_id
- Background tasks: use `set_profile_id()` before logging
- System logs: resolves to guest profile automatically

## Benefits

✅ **Centralized logging** - All logs in one place  
✅ **Queryable** - SQL queries for analysis  
✅ **Structured** - JSONB extra field for context  
✅ **Traceable** - profile_id links logs to users  
✅ **Module-based** - Automatic logger names from module paths  
✅ **No nulls** - Chris Date principles (guest profiles resolved)  

## Next Steps

1. Start with high-traffic modules (API routes, socket handlers)
2. Migrate utilities incrementally
3. Monitor database growth and add retention policy if needed
4. Consider adding log aggregation/analysis tools (Grafana, etc.)

