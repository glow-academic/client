-- Materialized View: training_department_mv
-- Grain: One row per training_department_entry.id
-- Filter: active = TRUE only
-- Purpose: training_department_entry data for view layer
-- Dependencies: training_department_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'training_department_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS training_department_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW training_department_mv AS
SELECT * FROM training_department_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX training_department_mv_pk ON training_department_mv (id);

-- Step 5: Filter indexes
CREATE INDEX training_department_mv_created_at_idx ON training_department_mv (created_at DESC);
CREATE INDEX training_department_mv_training_id_idx ON training_department_mv (training_id);
CREATE INDEX training_department_mv_departments_id_idx ON training_department_mv (departments_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW training_department_mv;
