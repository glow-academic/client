-- Materialized View: uploads_completions_mv
-- Grain: One row per uploads_completions_entry.id
-- Filter: active = TRUE only
-- Purpose: uploads_completions_entry data for view layer
-- Dependencies: uploads_completions_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'uploads_completions_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS uploads_completions_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW uploads_completions_mv AS
SELECT * FROM uploads_completions_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX uploads_completions_mv_pk ON uploads_completions_mv (id);

-- Step 5: Filter indexes
CREATE INDEX uploads_completions_mv_created_at_idx ON uploads_completions_mv (created_at DESC);
CREATE INDEX uploads_completions_mv_upload_id_idx ON uploads_completions_mv (upload_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW uploads_completions_mv;
