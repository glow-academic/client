-- Materialized View: groups_mv
-- Lean group-level data for group pages.
--
-- Grain: One row per active group
-- Filter: active = TRUE only
--
-- Purpose: Provides group-level IDs + timestamps for parallel fetching
-- Section: GROUP (lean MV - aggregates computed in Python)
--
-- Dependencies: Only uses _entry tables

CREATE MATERIALIZED VIEW groups_mv AS
SELECT
    -- Primary key
    g.id AS group_id,

    -- Session ID (nullable)
    g.session_id,

    -- Timestamps
    g.created_at AS group_created_at,

    -- Group metadata
    g.trace_id,
    g.name AS group_name,

    -- Active flag
    g.active

FROM groups_entry g
WHERE g.active = TRUE
WITH NO DATA;
