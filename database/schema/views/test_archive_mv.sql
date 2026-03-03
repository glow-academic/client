-- Materialized View: test_archive_mv
-- Grain: One row per test_archive_entry.id
-- Filter: active = TRUE only
-- Purpose: test_archive_entry data for view layer
-- Dependencies: test_archive_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW test_archive_mv AS
SELECT * FROM test_archive_entry WHERE active = true
WITH NO DATA;
