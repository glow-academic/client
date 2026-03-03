-- Materialized View: attempt_completion_mv
-- Grain: One row per attempt_completion_entry.id
-- Filter: active = TRUE only
-- Purpose: attempt_completion_entry data for view layer
-- Dependencies: attempt_completion_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW attempt_completion_mv AS
SELECT * FROM attempt_completion_entry WHERE active = true
WITH NO DATA;
