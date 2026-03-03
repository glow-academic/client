-- Materialized View: test_completion_mv
-- Grain: One row per test_completion_entry.id
-- Filter: active = TRUE only
-- Purpose: test_completion_entry data for view layer
-- Dependencies: test_completion_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW test_completion_mv AS
SELECT * FROM test_completion_entry WHERE active = true
WITH NO DATA;
