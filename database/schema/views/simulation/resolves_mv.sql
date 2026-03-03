-- Materialized View: resolves_mv
-- Grain: One row per resolves_entry.id
-- Filter: active = TRUE only
-- Purpose: resolves_entry data for view layer
-- Dependencies: resolves_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'resolves_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS resolves_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW resolves_mv AS
SELECT * FROM resolves_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX resolves_mv_pk ON resolves_mv (id);

-- Step 5: Filter indexes
CREATE INDEX resolves_mv_created_at_idx ON resolves_mv (created_at DESC);
CREATE INDEX resolves_mv_problem_id_idx ON resolves_mv (problem_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW resolves_mv;
