-- Materialized View: mv_grants
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
-- ============================================================================
-- Step 1: Drop all indexes on mv_grants materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_grants'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_grants materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_grants CASCADE;

-- ============================================================================
-- Step 3: Create mv_grants Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_grants AS
SELECT
    ge.id           AS grant_id,
    pgc.profiles_id AS grantor_id,
    ee.id           AS emulation_id,
    pec.profiles_id AS emulated_id,
    COALESCE(ge.session_id, ee.session_id) AS session_id,
    ge.expires_at,
    ge.used_at,
    ge.revoked_at,
    ge.created_at
FROM grants_entry ge
LEFT JOIN profiles_grants_connection pgc ON pgc.grant_id = ge.id AND pgc.active = true
LEFT JOIN emulations_entry ee ON ee.grant_id = ge.id
LEFT JOIN profiles_emulations_connection pec ON pec.emulation_id = ee.id AND pec.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_grants_pk
    ON mv_grants (grant_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_grants_grantor_id_idx
    ON mv_grants (grantor_id)
    WHERE grantor_id IS NOT NULL;

CREATE INDEX mv_grants_emulated_id_idx
    ON mv_grants (emulated_id)
    WHERE emulated_id IS NOT NULL;

CREATE INDEX mv_grants_session_id_idx
    ON mv_grants (session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX mv_grants_created_at_idx
    ON mv_grants (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_grants;
