-- Materialized View: suite_department_mv
-- Grain: One row per suite_department_entry.id
-- Filter: active = TRUE only
-- Purpose: suite_department_entry data for view layer
-- Dependencies: suite_department_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'suite_department_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS suite_department_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW suite_department_mv AS
SELECT * FROM suite_department_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX suite_department_mv_pk ON suite_department_mv (id);

-- Step 5: Filter indexes
CREATE INDEX suite_department_mv_created_at_idx ON suite_department_mv (created_at DESC);
CREATE INDEX suite_department_mv_suite_id_idx ON suite_department_mv (suite_id);
CREATE INDEX suite_department_mv_departments_id_idx ON suite_department_mv (departments_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW suite_department_mv;
