-- Materialized View: replacements_mv
-- Grain: One row per replacements_entry (message_feedback_id, idx)
-- Filter: active = TRUE only
-- Purpose: replacements_entry data for view layer
-- Dependencies: replacements_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'replacements_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS replacements_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW replacements_mv AS
SELECT * FROM replacements_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX replacements_mv_pk ON replacements_mv (message_feedback_id, idx);

-- Step 5: Filter indexes
CREATE INDEX replacements_mv_created_at_idx ON replacements_mv (created_at DESC);
CREATE INDEX replacements_mv_message_feedback_id_idx ON replacements_mv (message_feedback_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW replacements_mv;
