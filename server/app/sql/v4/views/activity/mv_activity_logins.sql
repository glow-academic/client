-- Materialized View: mv_activity_logins
-- Login-level facts for ACTIVITY section.
--
-- Grain: One row per login_id
-- Purpose: Fast login timeline and filtering by profile.
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: ACTIVITY
-- Source: logins_entry + profiles_logins_connection

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_activity_logins'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_activity_logins CASCADE;

CREATE MATERIALIZED VIEW mv_activity_logins AS
SELECT
    l.id AS login_id,
    pl.profiles_id,
    l.last_login,
    l.created_at,
    l.updated_at,
    COALESCE(l.active, false) AS active,
    l.generated,
    l.mcp,
    l.call_id
FROM logins_entry l
LEFT JOIN profiles_logins_connection pl
    ON pl.login_id = l.id
   AND pl.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_activity_logins_pk
    ON mv_activity_logins (login_id);

CREATE INDEX mv_activity_logins_profile_id_idx
    ON mv_activity_logins (profiles_id)
    WHERE profiles_id IS NOT NULL;

CREATE INDEX mv_activity_logins_last_login_idx
    ON mv_activity_logins (last_login DESC);

CREATE INDEX mv_activity_logins_created_at_idx
    ON mv_activity_logins (created_at DESC);

CREATE INDEX mv_activity_logins_active_idx
    ON mv_activity_logins (active);

REFRESH MATERIALIZED VIEW mv_activity_logins;
