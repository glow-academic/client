-- Materialized View: tokens_mv
-- Grain: One row per tokens_entry.id
-- Filter: active = TRUE only
-- Purpose: tokens_entry data for view layer
-- Dependencies: tokens_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'tokens_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS tokens_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW tokens_mv AS
SELECT * FROM tokens_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX tokens_mv_pk ON tokens_mv (id);

-- Step 5: Filter indexes
CREATE INDEX tokens_mv_created_at_idx ON tokens_mv (created_at DESC);
CREATE INDEX tokens_mv_run_id_idx ON tokens_mv (run_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW tokens_mv;
