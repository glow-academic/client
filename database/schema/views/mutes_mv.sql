-- Materialized View: mutes_mv
-- Grain: One row per mutes_entry.id
-- Filter: active = TRUE only
-- Purpose: mutes_entry data for view layer
-- Dependencies: mutes_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW mutes_mv AS
SELECT * FROM mutes_entry WHERE active = true
WITH NO DATA;
