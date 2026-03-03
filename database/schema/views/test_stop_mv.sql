-- Materialized View: test_stop_mv
-- Grain: One row per test_stop_entry.id
-- Filter: active = TRUE only
-- Purpose: test_stop_entry data for view layer
-- Dependencies: test_stop_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'test_stop_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS test_stop_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW test_stop_mv AS
SELECT * FROM test_stop_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX test_stop_mv_pk ON test_stop_mv (id);

-- Step 5: Filter indexes
CREATE INDEX test_stop_mv_created_at_idx ON test_stop_mv (created_at DESC);
CREATE INDEX test_stop_mv_invocation_id_idx ON test_stop_mv (invocation_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW test_stop_mv;

CREATE MATERIALIZED VIEW test_stop_mv AS
SELECT * FROM test_stop_entry WHERE active = true
WITH NO DATA;
