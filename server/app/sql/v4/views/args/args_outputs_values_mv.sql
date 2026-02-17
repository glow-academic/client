-- Materialized View: args_outputs_values_mv
-- Grain: One row per args_outputs_values_entry.id
-- Filter: None (no active column)
-- Purpose: args_outputs_values_entry data for view layer
-- Dependencies: args_outputs_values_entry

-- Step 1: Drop indexes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'args_outputs_values_mv'
    LOOP EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname); END LOOP;
END $$;

-- Step 2: Drop MV
DROP MATERIALIZED VIEW IF EXISTS args_outputs_values_mv CASCADE;

-- Step 3: Create MV
CREATE MATERIALIZED VIEW args_outputs_values_mv AS
SELECT * FROM args_outputs_values_entry
WITH NO DATA;

-- Step 4: Unique index
CREATE UNIQUE INDEX args_outputs_values_mv_pk ON args_outputs_values_mv (id);

-- Step 5: Filter indexes
CREATE INDEX args_outputs_values_mv_created_at_idx ON args_outputs_values_mv (created_at DESC);
CREATE INDEX args_outputs_values_mv_call_id_idx ON args_outputs_values_mv (call_id);

-- Step 6: Refresh
REFRESH MATERIALIZED VIEW args_outputs_values_mv;
