-- Materialized View: mv_logins
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
-- Step 1: Drop all indexes on mv_logins materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_logins'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_logins materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_logins CASCADE;

-- ============================================================================
-- Step 3: Create mv_logins Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_logins AS
SELECT
    l.id AS login_id,
    plc.profiles_id AS profile_id,
    l.session_id,
    l.last_login,
    l.created_at AS login_created_at,
    COALESCE(l.active, false) AS active,
    l.generated,
    l.mcp,
    l.call_id
FROM logins_entry l
LEFT JOIN profiles_logins_connection plc
    ON plc.login_id = l.id
    AND plc.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_logins_pk
    ON mv_logins (login_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_logins_profile_id_idx
    ON mv_logins (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_logins_session_id_idx
    ON mv_logins (session_id);

CREATE INDEX mv_logins_last_login_idx
    ON mv_logins (last_login DESC);

CREATE INDEX mv_logins_created_at_idx
    ON mv_logins (login_created_at DESC);

CREATE INDEX mv_logins_active_idx
    ON mv_logins (active);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_logins;
