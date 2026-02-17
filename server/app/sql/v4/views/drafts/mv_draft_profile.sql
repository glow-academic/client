-- Materialized View: mv_draft_profile
-- Per-artifact draft MV for profile drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_draft_profile'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_draft_profile CASCADE;

CREATE MATERIALIZED VIEW mv_draft_profile AS
WITH draft_links AS (
    SELECT draft_id, 'cohorts'::text AS resource_type, cohorts_id AS resource_id FROM profile_drafts_cohorts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM profile_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'emails'::text AS resource_type, emails_id AS resource_id FROM profile_drafts_emails_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM profile_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM profile_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'profiles'::text AS resource_type, profiles_id AS resource_id FROM profile_drafts_profiles_connection WHERE active = true
    UNION ALL SELECT draft_id, 'request_limits'::text AS resource_type, request_limits_id AS resource_id FROM profile_drafts_request_limits_connection WHERE active = true
    UNION ALL SELECT draft_id, 'roles'::text AS resource_type, roles_id AS resource_id FROM profile_drafts_roles_connection WHERE active = true
    UNION ALL SELECT draft_id, 'routes'::text AS resource_type, routes_id AS resource_id FROM profile_drafts_routes_connection WHERE active = true
)
SELECT
    d.id AS draft_id,
    d.created_at,
    d.updated_at,
    d.version,
    d.generated,
    d.mcp,
    d.active,
    (SELECT ggc.groups_id FROM groups_groups_connection ggc WHERE ggc.group_id = d.group_id AND ggc.active = true LIMIT 1) AS group_id,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'cohorts'), ARRAY[]::uuid[]) AS cohort_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'emails'), ARRAY[]::uuid[]) AS email_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'profiles'), ARRAY[]::uuid[]) AS profile_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'request_limits'), ARRAY[]::uuid[]) AS request_limit_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'roles'), ARRAY[]::uuid[]) AS role_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'routes'), ARRAY[]::uuid[]) AS route_ids
FROM profile_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX mv_draft_profile_pk ON mv_draft_profile (draft_id);

REFRESH MATERIALIZED VIEW mv_draft_profile;
