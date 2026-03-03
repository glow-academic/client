-- Materialized View: personas_mv
-- Grain: One row per personas_entry.id
-- Filter: active = TRUE only
-- Purpose: personas_entry data for view layer
-- Dependencies: personas_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW personas_mv AS
SELECT * FROM personas_entry WHERE active = true
WITH NO DATA;
