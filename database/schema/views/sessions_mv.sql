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
    psc.profiles_id AS profile_id,

    -- Timestamps
    s.created_at AS session_created_at,

    -- Active flag
    s.active,

    -- MCP flag
    s.mcp

FROM sessions_entry s
JOIN profiles_sessions_connection psc ON psc.session_id = s.id
WITH NO DATA;
