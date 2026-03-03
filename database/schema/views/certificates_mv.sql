-- Materialized View: certificates_mv
-- Grain: One row per certificates_entry.id
-- Filter: active = TRUE only
-- Purpose: certificates_entry data for view layer
-- Dependencies: certificates_entry

-- Step 1: Drop indexes

CREATE MATERIALIZED VIEW certificates_mv AS
SELECT * FROM certificates_entry WHERE active = true
WITH NO DATA;
