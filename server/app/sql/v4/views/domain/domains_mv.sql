-- Materialized View: domains_mv
-- Grain: One row per domains_entry.id
-- Filter: active = TRUE only
-- Purpose: domains_entry data for view layer
-- Dependencies: domains_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'domains_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS domains_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW domains_mv AS
SELECT * FROM domains_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX domains_mv_pk ON domains_mv (id);

-- Step 5: Filter indexes
CREATE INDEX domains_mv_created_at_idx ON domains_mv (created_at DESC);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW domains_mv;
