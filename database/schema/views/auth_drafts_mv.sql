-- Materialized View: auth_drafts_mv
-- Per-artifact draft MV for auth drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'auth_drafts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS auth_drafts_mv CASCADE;

CREATE MATERIALIZED VIEW auth_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'auths'::text AS resource_type, auths_id AS resource_id FROM auth_drafts_auths_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM auth_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM auth_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM auth_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'items'::text AS resource_type, items_id AS resource_id FROM auth_drafts_items_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM auth_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'protocols'::text AS resource_type, protocols_id AS resource_id FROM auth_drafts_protocols_connection WHERE active = true
    UNION ALL SELECT draft_id, 'slugs'::text AS resource_type, slugs_id AS resource_id FROM auth_drafts_slugs_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'auths'), ARRAY[]::uuid[]) AS auth_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'items'), ARRAY[]::uuid[]) AS item_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'protocols'), ARRAY[]::uuid[]) AS protocol_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'slugs'), ARRAY[]::uuid[]) AS slug_ids
FROM auth_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX auth_drafts_mv_pk ON auth_drafts_mv (draft_id);

REFRESH MATERIALIZED VIEW auth_drafts_mv;

CREATE MATERIALIZED VIEW auth_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'auths'::text AS resource_type, auths_id AS resource_id FROM auth_drafts_auths_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM auth_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM auth_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM auth_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'items'::text AS resource_type, items_id AS resource_id FROM auth_drafts_items_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM auth_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'protocols'::text AS resource_type, protocols_id AS resource_id FROM auth_drafts_protocols_connection WHERE active = true
    UNION ALL SELECT draft_id, 'slugs'::text AS resource_type, slugs_id AS resource_id FROM auth_drafts_slugs_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'auths'), ARRAY[]::uuid[]) AS auth_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'items'), ARRAY[]::uuid[]) AS item_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'protocols'), ARRAY[]::uuid[]) AS protocol_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'slugs'), ARRAY[]::uuid[]) AS slug_ids
FROM auth_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;
