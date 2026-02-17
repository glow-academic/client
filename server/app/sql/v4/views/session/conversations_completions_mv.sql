-- Materialized View: conversations_completions_mv
-- Grain: One row per conversations_completions_entry.id
-- Filter: active = TRUE only
-- Purpose: conversations_completions_entry data for view layer
-- Dependencies: conversations_completions_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'conversations_completions_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS conversations_completions_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW conversations_completions_mv AS
SELECT * FROM conversations_completions_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX conversations_completions_mv_pk ON conversations_completions_mv (id);

-- Step 5: Filter indexes
CREATE INDEX conversations_completions_mv_created_at_idx ON conversations_completions_mv (created_at DESC);
CREATE INDEX conversations_completions_mv_conversation_id_idx ON conversations_completions_mv (conversation_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW conversations_completions_mv;
