-- Materialized View: emulations_mv
-- Grain: One row per emulations_entry.id
-- Filter: No active column — includes all rows
-- Purpose: emulations_entry data for view layer
-- Dependencies: emulations_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'emulations_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS emulations_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW emulations_mv AS
SELECT * FROM emulations_entry
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX emulations_mv_pk ON emulations_mv (id);

-- Step 5: Filter indexes
CREATE INDEX emulations_mv_created_at_idx ON emulations_mv (created_at DESC);
CREATE INDEX emulations_mv_session_id_idx ON emulations_mv (session_id);
CREATE INDEX emulations_mv_grant_id_idx ON emulations_mv (grant_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW emulations_mv;

CREATE MATERIALIZED VIEW emulations_mv AS
SELECT * FROM emulations_entry
WITH NO DATA;
