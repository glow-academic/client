-- Materialized View: conversations_mv
-- Grain: One row per conversations_entry.id
-- Filter: active = TRUE only
-- Purpose: conversations_entry data for view layer
-- Dependencies: conversations_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW conversations_mv AS
SELECT * FROM conversations_entry WHERE active = true
WITH NO DATA;
