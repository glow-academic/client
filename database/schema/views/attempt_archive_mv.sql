-- Materialized View: attempt_archive_mv
-- Grain: One row per attempt_archive_entry.id
-- Filter: active = TRUE only
-- Purpose: attempt_archive_entry data for view layer
-- Dependencies: attempt_archive_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW attempt_archive_mv AS
SELECT * FROM attempt_archive_entry WHERE active = true
WITH NO DATA;
