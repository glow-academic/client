-- Materialized View: grants_mv
-- Lean grant-level data for grant views.
--
-- Grain: One row per grant
-- Filter: none
--
-- Purpose: Grant data with grantor/emulated profile IDs
-- Section: GRANT (lean MV)
--
-- Dependencies: grants_entry, profiles_grants_connection, emulations_entry,
--               profiles_emulations_connection

CREATE MATERIALIZED VIEW grants_mv AS
SELECT
    ge.id           AS grant_id,
    pgc.profiles_id AS grantor_id,
    ee.id           AS emulation_id,
    pec.profiles_id AS emulated_id,
    ge.session_id  AS grant_session_id,
    ee.session_id  AS emulation_session_id,
    ge.expires_at,
    ge.used_at,
    ge.revoked_at,
    ge.created_at
FROM grants_entry ge
LEFT JOIN profiles_grants_connection pgc ON pgc.grant_id = ge.id AND pgc.active = true
LEFT JOIN emulations_entry ee ON ee.grant_id = ge.id
LEFT JOIN profiles_emulations_connection pec ON pec.emulation_id = ee.id AND pec.active = true
WITH NO DATA;
