-- Materialized View: debug_info_mv
-- Grain: One row per debug_info_entry.id
-- Filter: active = TRUE only
-- Purpose: debug_info_entry data for view layer
-- Dependencies: debug_info_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW debug_info_mv AS
SELECT * FROM debug_info_entry WHERE active = true
WITH NO DATA;
