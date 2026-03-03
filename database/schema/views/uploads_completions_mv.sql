-- Materialized View: uploads_completions_mv
-- Grain: One row per uploads_completions_entry.id
-- Filter: active = TRUE only
-- Purpose: uploads_completions_entry data for view layer
-- Dependencies: uploads_completions_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW uploads_completions_mv AS
SELECT * FROM uploads_completions_entry WHERE active = true
WITH NO DATA;
