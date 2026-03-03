-- Materialized View: certificates_mv
-- Grain: One row per certificates_entry.id
-- Filter: active = TRUE only
-- Purpose: certificates_entry data for view layer
-- Dependencies: certificates_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'certificates_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS certificates_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW certificates_mv AS
SELECT * FROM certificates_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX certificates_mv_pk ON certificates_mv (id);

-- Step 5: Filter indexes
CREATE INDEX certificates_mv_created_at_idx ON certificates_mv (created_at DESC);
CREATE INDEX certificates_mv_upload_id_idx ON certificates_mv (upload_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW certificates_mv;
