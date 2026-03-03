-- Materialized View: sessions_mv
-- Lean session-level data for session pages.
--
-- Grain: One row per session
-- Filter: None (active is a column, not a filter)
--
-- Purpose: Provides session-level IDs + timestamps for parallel fetching
-- Section: SESSION (lean MV - aggregates computed in Python)
--
-- Dependencies: Only uses _entry tables

CREATE MATERIALIZED VIEW sessions_mv AS
SELECT
    -- Primary key
    s.id AS session_id,

    -- Profile ID (for permission checks and filtering)
    s.profile_id,

    -- Timestamps
    s.created_at AS session_created_at,

    -- Active flag
    s.active

FROM sessions_entry s
WITH NO DATA;
