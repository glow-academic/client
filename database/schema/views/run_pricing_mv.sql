-- Materialized View: run_pricing_mv
-- Grain: One row per run_pricing_entry.id
-- Filter: active = TRUE only
-- Purpose: run_pricing_entry data for view layer
-- Dependencies: run_pricing_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'run_pricing_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS run_pricing_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW run_pricing_mv AS
SELECT * FROM run_pricing_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX run_pricing_mv_pk ON run_pricing_mv (id);

-- Step 5: Filter indexes
CREATE INDEX run_pricing_mv_created_at_idx ON run_pricing_mv (created_at DESC);
CREATE INDEX run_pricing_mv_run_id_idx ON run_pricing_mv (run_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW run_pricing_mv;

CREATE MATERIALIZED VIEW run_pricing_mv AS
SELECT * FROM run_pricing_entry WHERE active = true
WITH NO DATA;
