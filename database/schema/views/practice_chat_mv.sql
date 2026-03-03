-- Materialized View: practice_chat_mv
-- Grain: One row per practice_chat_entry.id
-- Filter: active = TRUE only
-- Purpose: practice_chat_entry data for view layer
-- Dependencies: practice_chat_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW practice_chat_mv AS
SELECT * FROM practice_chat_entry WHERE active = true
WITH NO DATA;
