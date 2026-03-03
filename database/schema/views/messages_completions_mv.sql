-- Materialized View: messages_completions_mv
-- Grain: One row per messages_completions_entry.id
-- Filter: active = TRUE only
-- Purpose: messages_completions_entry data for view layer
-- Dependencies: messages_completions_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW messages_completions_mv AS
SELECT * FROM messages_completions_entry WHERE active = true
WITH NO DATA;
