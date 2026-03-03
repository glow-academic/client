-- Materialized View: conversations_completions_mv
-- Grain: One row per conversations_completions_entry.id
-- Filter: active = TRUE only
-- Purpose: conversations_completions_entry data for view layer
-- Dependencies: conversations_completions_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW conversations_completions_mv AS
SELECT * FROM conversations_completions_entry WHERE active = true
WITH NO DATA;
