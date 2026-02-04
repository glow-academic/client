-- Materialized View: mv_activity_audits
-- Audit-level facts for ACTIVITY section.
--
-- Grain: One row per audit event
-- Purpose: Fast audit log list with profile/session context.
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: ACTIVITY
-- Source: audits_entry + sessions_entry

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_activity_audits'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_activity_audits CASCADE;

CREATE MATERIALIZED VIEW mv_activity_audits AS
SELECT
    a.id AS audit_id,
    a.created_at,
    a.endpoint,
    a.message,
    a.error,
    a.session_id,
    s.profile_id
FROM audits_entry a
LEFT JOIN sessions_entry s ON s.id = a.session_id
WITH NO DATA;

CREATE UNIQUE INDEX mv_activity_audits_pk
    ON mv_activity_audits (audit_id);

CREATE INDEX mv_activity_audits_profile_id_idx
    ON mv_activity_audits (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_activity_audits_session_id_idx
    ON mv_activity_audits (session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX mv_activity_audits_created_at_idx
    ON mv_activity_audits (created_at DESC);

CREATE INDEX mv_activity_audits_endpoint_idx
    ON mv_activity_audits (endpoint);

CREATE INDEX mv_activity_audits_error_idx
    ON mv_activity_audits (error);

REFRESH MATERIALIZED VIEW mv_activity_audits;
