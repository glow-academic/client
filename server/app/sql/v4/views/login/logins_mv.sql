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
-- ============================================================================
-- Step 1: Drop all indexes on logins_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'logins_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop logins_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS logins_mv CASCADE;

-- ============================================================================
-- Step 3: Create logins_mv Materialized View
-- ============================================================================

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

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX logins_mv_pk
    ON logins_mv (login_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX logins_mv_profile_id_idx
    ON logins_mv (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX logins_mv_session_id_idx
    ON logins_mv (session_id);

CREATE INDEX logins_mv_last_login_idx
    ON logins_mv (last_login DESC);

CREATE INDEX logins_mv_created_at_idx
    ON logins_mv (login_created_at DESC);

CREATE INDEX logins_mv_active_idx
    ON logins_mv (active);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW logins_mv;
