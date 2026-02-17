-- Materialized View: persona_mv
-- Grain: One row per persona_entry.id
-- Filter: active = TRUE only
-- Purpose: persona_entry data for view layer
-- Dependencies: persona_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'persona_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS persona_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW persona_mv AS
SELECT * FROM persona_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX persona_mv_pk ON persona_mv (id);

-- Step 5: Filter indexes
CREATE INDEX persona_mv_created_at_idx ON persona_mv (created_at DESC);
CREATE INDEX persona_mv_training_id_idx ON persona_mv (training_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW persona_mv;
