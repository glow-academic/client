-- Materialized View: conversations_mv
-- Grain: One row per conversations_entry.id
-- Filter: active = TRUE only
-- Purpose: conversations_entry data for view layer
-- Dependencies: conversations_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'conversations_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS conversations_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW conversations_mv AS
SELECT * FROM conversations_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX conversations_mv_pk ON conversations_mv (id);

-- Step 5: Filter indexes
CREATE INDEX conversations_mv_created_at_idx ON conversations_mv (created_at DESC);
CREATE INDEX conversations_mv_chat_id_idx ON conversations_mv (chat_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW conversations_mv;
