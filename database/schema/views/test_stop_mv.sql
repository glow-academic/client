-- Materialized View: test_stop_mv
-- Grain: One row per test_stop_entry.id
-- Filter: active = TRUE only
-- Purpose: test_stop_entry data for view layer
-- Dependencies: test_stop_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW test_stop_mv AS
SELECT * FROM test_stop_entry WHERE active = true
WITH NO DATA;
