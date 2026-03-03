-- Materialized View: logins_mv
-- Lean login-level data for activity pages.
--
-- Grain: One row per login
-- Filter: none
--
-- Purpose: Login timeline with profile_id — name resolved in hydration layer
-- Section: LOGIN (lean MV)
--
-- Dependencies: logins_entry, profiles_logins_connection

CREATE MATERIALIZED VIEW logins_mv AS
SELECT
    l.id AS login_id,
    plc.profiles_id AS profile_id,
    l.session_id,
    l.last_login,
    l.created_at AS login_created_at,
    COALESCE(l.active, false) AS active,
    l.generated,
    l.mcp
FROM logins_entry l
LEFT JOIN profiles_logins_connection plc
    ON plc.login_id = l.id
    AND plc.active = true
WITH NO DATA;
