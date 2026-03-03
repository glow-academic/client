-- Materialized View: debug_info_mv
-- Grain: One row per debug_info_entry.id
-- Filter: active = TRUE only
-- Purpose: debug_info_entry data for view layer
-- Dependencies: debug_info_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'debug_info_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS debug_info_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW debug_info_mv AS
SELECT * FROM debug_info_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX debug_info_mv_pk ON debug_info_mv (id);

-- Step 5: Filter indexes
CREATE INDEX debug_info_mv_created_at_idx ON debug_info_mv (created_at DESC);
CREATE INDEX debug_info_mv_call_id_idx ON debug_info_mv (call_id);
CREATE INDEX debug_info_mv_run_id_idx ON debug_info_mv (run_id);
CREATE INDEX debug_info_mv_mcp_idx ON debug_info_mv (mcp);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW debug_info_mv;
