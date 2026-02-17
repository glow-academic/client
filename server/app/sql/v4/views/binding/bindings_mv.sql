-- Materialized View: bindings_mv
-- Grain: One row per bindings_entry.id
-- Filter: active = TRUE only
-- Purpose: bindings_entry data for view layer
-- Dependencies: bindings_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'bindings_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS bindings_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW bindings_mv AS
SELECT * FROM bindings_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX bindings_mv_pk ON bindings_mv (id);

-- Step 5: Filter indexes
CREATE INDEX bindings_mv_created_at_idx ON bindings_mv (created_at DESC);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW bindings_mv;
