-- Materialized View: home_chat_mv
-- Grain: One row per home_chat_entry.id
-- Filter: active = TRUE only
-- Purpose: home_chat_entry data for view layer
-- Dependencies: home_chat_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'home_chat_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS home_chat_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW home_chat_mv AS
SELECT * FROM home_chat_entry WHERE active = true
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX home_chat_mv_pk ON home_chat_mv (id);

-- Step 5: Filter indexes
CREATE INDEX home_chat_mv_created_at_idx ON home_chat_mv (created_at DESC);
CREATE INDEX home_chat_mv_home_id_idx ON home_chat_mv (home_id);
CREATE INDEX home_chat_mv_chat_id_idx ON home_chat_mv (chat_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW home_chat_mv;

CREATE MATERIALIZED VIEW home_chat_mv AS
SELECT * FROM home_chat_entry WHERE active = true
WITH NO DATA;
