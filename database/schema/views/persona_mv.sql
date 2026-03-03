-- Materialized View: personas_mv
-- Grain: One row per personas_entry.id
-- Filter: active = TRUE only
-- Purpose: personas_entry data for view layer
-- Dependencies: personas_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'personas_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Also drop old MV if it exists
DROP MATERIALIZED VIEW IF EXISTS profile_personas_mv CASCADE;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS personas_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW personas_mv AS
SELECT * FROM personas_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX personas_mv_pk ON personas_mv (id);

-- Step 5: Filter indexes
CREATE INDEX personas_mv_created_at_idx ON personas_mv (created_at DESC);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW personas_mv;

CREATE MATERIALIZED VIEW personas_mv AS
SELECT * FROM personas_entry WHERE active = true
WITH NO DATA;
