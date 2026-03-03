-- Materialized View: attempt_completion_mv
-- Grain: One row per attempt_completion_entry.id
-- Filter: active = TRUE only
-- Purpose: attempt_completion_entry data for view layer
-- Dependencies: attempt_completion_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'attempt_completion_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS attempt_completion_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW attempt_completion_mv AS
SELECT * FROM attempt_completion_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX attempt_completion_mv_pk ON attempt_completion_mv (id);

-- Step 5: Filter indexes
CREATE INDEX attempt_completion_mv_created_at_idx ON attempt_completion_mv (created_at DESC);
CREATE INDEX attempt_completion_mv_chat_id_idx ON attempt_completion_mv (chat_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW attempt_completion_mv;

CREATE MATERIALIZED VIEW attempt_completion_mv AS
SELECT * FROM attempt_completion_entry WHERE active = true
WITH NO DATA;
