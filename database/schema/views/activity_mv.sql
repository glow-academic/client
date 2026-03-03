-- Materialized View: activity_mv
-- Lean activity-level data for activity views.
--
-- Grain: One row per activity entry
-- Filter: active = true only
--
-- Purpose: Activity data with profile_id and session_id
-- Section: ACTIVITY (lean MV)
--
-- Dependencies: activity_entry, profiles_activity_connection

CREATE MATERIALIZED VIEW activity_mv AS
SELECT
    a.id          AS activity_id,
    pac.profiles_id AS profile_id,
    a.session_id,
    a.last_active,
    a.created_at
FROM activity_entry a
LEFT JOIN profiles_activity_connection pac
    ON pac.activity_id = a.id
    AND pac.active = true
WHERE a.active = true
WITH NO DATA;
