-- Materialized View: tokens_mv
-- Grain: One row per tokens_entry.id
-- Filter: active = TRUE only
-- Purpose: tokens_entry data for view layer
-- Dependencies: tokens_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW tokens_mv AS
SELECT * FROM tokens_entry WHERE active = true
WITH NO DATA;
