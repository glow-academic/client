-- Materialized View: health_insights_mv
-- Grain: One row per health_insights_entry.id
-- Filter: active = TRUE only
-- Purpose: health_insights_entry insights data for view layer
-- Dependencies: health_insights_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'health_insights_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS health_insights_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW health_insights_mv AS
SELECT * FROM health_insights_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX health_insights_mv_pk ON health_insights_mv (id);

-- Step 5: Filter indexes
CREATE INDEX health_insights_mv_created_at_idx ON health_insights_mv (created_at DESC);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW health_insights_mv;
