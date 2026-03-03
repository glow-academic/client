-- Materialized View: home_chat_mv
-- Grain: One row per home_chat_entry.id
-- Filter: active = TRUE only
-- Purpose: home_chat_entry data for view layer
-- Dependencies: home_chat_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW home_chat_mv AS
SELECT * FROM home_chat_entry WHERE active = true
WITH NO DATA;
