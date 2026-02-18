-- Materialized View: provider_drafts_mv
-- Per-artifact draft MV for provider drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'provider_drafts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS provider_drafts_mv CASCADE;

CREATE MATERIALIZED VIEW provider_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM provider_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM provider_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'endpoints'::text AS resource_type, endpoints_id AS resource_id FROM provider_drafts_endpoints_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM provider_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'keys'::text AS resource_type, keys_id AS resource_id FROM provider_drafts_keys_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM provider_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'providers'::text AS resource_type, providers_id AS resource_id FROM provider_drafts_providers_connection WHERE active = true
    UNION ALL SELECT draft_id, 'values'::text AS resource_type, values_id AS resource_id FROM provider_drafts_values_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'endpoints'), ARRAY[]::uuid[]) AS endpoint_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'keys'), ARRAY[]::uuid[]) AS key_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'providers'), ARRAY[]::uuid[]) AS provider_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'values'), ARRAY[]::uuid[]) AS value_ids
FROM provider_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX provider_drafts_mv_pk ON provider_drafts_mv (draft_id);

REFRESH MATERIALIZED VIEW provider_drafts_mv;
