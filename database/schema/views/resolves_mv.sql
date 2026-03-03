-- Materialized View: resolves_mv
-- Grain: One row per resolves_entry.id
-- Filter: active = TRUE only
-- Purpose: resolves_entry data for view layer
-- Dependencies: resolves_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW resolves_mv AS
SELECT * FROM resolves_entry WHERE active = true
WITH NO DATA;
