-- Materialized View: home_training_mv
-- Grain: One row per home_training_entry.id
-- Filter: active = TRUE only
-- Purpose: home_training_entry data for view layer
-- Dependencies: home_training_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'home_training_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS home_training_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW home_training_mv AS
SELECT * FROM home_training_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX home_training_mv_pk ON home_training_mv (id);

-- Step 5: Filter indexes
CREATE INDEX home_training_mv_created_at_idx ON home_training_mv (created_at DESC);
CREATE INDEX home_training_mv_home_id_idx ON home_training_mv (home_id);
CREATE INDEX home_training_mv_training_id_idx ON home_training_mv (training_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW home_training_mv;
