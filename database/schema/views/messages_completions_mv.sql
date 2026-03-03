-- Materialized View: messages_completions_mv
-- Grain: One row per messages_completions_entry.id
-- Filter: active = TRUE only
-- Purpose: messages_completions_entry data for view layer
-- Dependencies: messages_completions_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'messages_completions_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS messages_completions_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW messages_completions_mv AS
SELECT * FROM messages_completions_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX messages_completions_mv_pk ON messages_completions_mv (id);

-- Step 5: Filter indexes
CREATE INDEX messages_completions_mv_created_at_idx ON messages_completions_mv (created_at DESC);
CREATE INDEX messages_completions_mv_message_id_idx ON messages_completions_mv (message_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW messages_completions_mv;

CREATE MATERIALIZED VIEW messages_completions_mv AS
SELECT * FROM messages_completions_entry WHERE active = true
WITH NO DATA;
