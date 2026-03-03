-- Materialized View: reports_mv
-- Grain: One row per reports_entry.id
-- Filter: active = TRUE only
-- Purpose: reports_entry data for view layer
-- Dependencies: reports_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'reports_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS reports_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW reports_mv AS
SELECT * FROM reports_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX reports_mv_pk ON reports_mv (id);

-- Step 5: Filter indexes
CREATE INDEX reports_mv_created_at_idx ON reports_mv (created_at DESC);
CREATE INDEX reports_mv_upload_id_idx ON reports_mv (upload_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW reports_mv;

CREATE MATERIALIZED VIEW reports_mv AS
SELECT * FROM reports_entry WHERE active = true
WITH NO DATA;
