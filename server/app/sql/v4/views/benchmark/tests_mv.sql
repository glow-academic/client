-- Materialized View: tests_mv
-- Grain: One row per tests_entry.id
-- Filter: active = TRUE only
-- Purpose: tests_entry data for view layer
-- Dependencies: tests_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'tests_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS tests_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW tests_mv AS
SELECT * FROM tests_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX tests_mv_pk ON tests_mv (id);

-- Step 5: Filter indexes
CREATE INDEX tests_mv_created_at_idx ON tests_mv (created_at DESC);
CREATE INDEX tests_mv_attempt_id_idx ON tests_mv (attempt_id);
CREATE INDEX tests_mv_group_id_idx ON tests_mv (group_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW tests_mv;
