-- Materialized View: highlights_mv
-- Grain: One row per highlights_entry (message_feedback_id, idx)
-- Filter: active = TRUE only
-- Purpose: highlights_entry data for view layer
-- Dependencies: highlights_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'highlights_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS highlights_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW highlights_mv AS
SELECT * FROM highlights_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX highlights_mv_pk ON highlights_mv (message_feedback_id, idx);

-- Step 5: Filter indexes
CREATE INDEX highlights_mv_created_at_idx ON highlights_mv (created_at DESC);
CREATE INDEX highlights_mv_message_feedback_id_idx ON highlights_mv (message_feedback_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW highlights_mv;
