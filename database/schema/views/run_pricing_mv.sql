-- Materialized View: run_pricing_mv
-- Grain: One row per run_pricing_entry.id
-- Filter: active = TRUE only
-- Purpose: run_pricing_entry data for view layer
-- Dependencies: run_pricing_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW run_pricing_mv AS
SELECT * FROM run_pricing_entry WHERE active = true
WITH NO DATA;
