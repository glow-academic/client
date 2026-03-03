-- Materialized View: test_grade_mv
-- Grain: One row per test_grade_entry.id
-- Filter: active = TRUE only
-- Purpose: test_grade_entry data for view layer
-- Dependencies: test_grade_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW test_grade_mv AS
SELECT * FROM test_grade_entry WHERE active = true
WITH NO DATA;
