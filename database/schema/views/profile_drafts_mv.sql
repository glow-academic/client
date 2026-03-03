-- Materialized View: profile_drafts_mv
-- Per-artifact draft MV for profile drafts with denormalized resource IDs.

CREATE MATERIALIZED VIEW profile_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM profile_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'emails'::text AS resource_type, emails_id AS resource_id FROM profile_drafts_emails_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM profile_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM profile_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'profiles'::text AS resource_type, profiles_id AS resource_id FROM profile_drafts_profiles_connection WHERE active = true
    UNION ALL SELECT draft_id, 'request_limits'::text AS resource_type, request_limits_id AS resource_id FROM profile_drafts_request_limits_connection WHERE active = true
    UNION ALL SELECT draft_id, 'roles'::text AS resource_type, roles_id AS resource_id FROM profile_drafts_roles_connection WHERE active = true
)
SELECT
    d.id AS draft_id,
    d.created_at,
    d.updated_at,
    d.version,
    d.generated,
    d.mcp,
    d.active,
    d.group_id,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'emails'), ARRAY[]::uuid[]) AS email_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'profiles'), ARRAY[]::uuid[]) AS profile_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'request_limits'), ARRAY[]::uuid[]) AS request_limit_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'roles'), ARRAY[]::uuid[]) AS role_ids
FROM profile_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;
