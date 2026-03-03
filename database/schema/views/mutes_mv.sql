-- Materialized View: mutes_mv
-- Grain: One row per mutes_entry.id
-- Filter: active = TRUE only
-- Purpose: mutes_entry data for view layer
-- Dependencies: mutes_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'mutes_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS mutes_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW mutes_mv AS
SELECT * FROM mutes_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX mutes_mv_pk ON mutes_mv (id);

-- Step 5: Filter indexes
CREATE INDEX mutes_mv_created_at_idx ON mutes_mv (created_at DESC);
CREATE INDEX mutes_mv_conversation_id_idx ON mutes_mv (conversation_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW mutes_mv;

CREATE MATERIALIZED VIEW mutes_mv AS
SELECT * FROM mutes_entry WHERE active = true
WITH NO DATA;
