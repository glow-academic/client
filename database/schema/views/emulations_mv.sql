-- Materialized View: emulations_mv
-- Grain: One row per emulations_entry.id
-- Filter: No active column — includes all rows
-- Purpose: emulations_entry data for view layer
-- Dependencies: emulations_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW emulations_mv AS
SELECT * FROM emulations_entry
WITH NO DATA;
