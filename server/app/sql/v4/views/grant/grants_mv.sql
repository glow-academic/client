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
-- ============================================================================
-- Step 1: Drop all indexes on grants_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'grants_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop grants_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS grants_mv CASCADE;

-- ============================================================================
-- Step 3: Create grants_mv Materialized View
-- ============================================================================

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

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX grants_mv_pk
    ON grants_mv (grant_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX grants_mv_grantor_id_idx
    ON grants_mv (grantor_id)
    WHERE grantor_id IS NOT NULL;

CREATE INDEX grants_mv_emulated_id_idx
    ON grants_mv (emulated_id)
    WHERE emulated_id IS NOT NULL;

CREATE INDEX grants_mv_grant_session_id_idx
    ON grants_mv (grant_session_id)
    WHERE grant_session_id IS NOT NULL;

CREATE INDEX grants_mv_emulation_session_id_idx
    ON grants_mv (emulation_session_id)
    WHERE emulation_session_id IS NOT NULL;

CREATE INDEX grants_mv_created_at_idx
    ON grants_mv (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW grants_mv;
