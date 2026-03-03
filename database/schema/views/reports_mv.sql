-- Materialized View: reports_mv
-- Grain: One row per reports_entry.id
-- Filter: active = TRUE only
-- Purpose: reports_entry data for view layer
-- Dependencies: reports_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW reports_mv AS
SELECT * FROM reports_entry WHERE active = true
WITH NO DATA;
