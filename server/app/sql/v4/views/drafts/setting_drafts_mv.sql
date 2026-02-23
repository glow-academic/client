-- Materialized View: setting_drafts_mv
-- Per-artifact draft MV for setting drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'setting_drafts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS setting_drafts_mv CASCADE;

CREATE MATERIALIZED VIEW setting_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'agents'::text AS resource_type, agents_id AS resource_id FROM setting_drafts_agents_connection WHERE active = true
    UNION ALL SELECT draft_id, 'auth_item_keys'::text AS resource_type, auth_item_keys_id AS resource_id FROM setting_drafts_auth_item_keys_connection WHERE active = true
    UNION ALL SELECT draft_id, 'auths'::text AS resource_type, auths_id AS resource_id FROM setting_drafts_auths_connection WHERE active = true
    UNION ALL SELECT draft_id, 'colors'::text AS resource_type, colors_id AS resource_id FROM setting_drafts_colors_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM setting_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM setting_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM setting_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'items'::text AS resource_type, items_id AS resource_id FROM setting_drafts_items_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM setting_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'profiles'::text AS resource_type, profiles_id AS resource_id FROM setting_drafts_profiles_connection WHERE active = true
    UNION ALL SELECT draft_id, 'provider_keys'::text AS resource_type, provider_keys_id AS resource_id FROM setting_drafts_provider_keys_connection WHERE active = true
    UNION ALL SELECT draft_id, 'settings'::text AS resource_type, settings_id AS resource_id FROM setting_drafts_settings_connection WHERE active = true
    UNION ALL SELECT draft_id, 'thresholds'::text AS resource_type, thresholds_id AS resource_id FROM setting_drafts_thresholds_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'agents'), ARRAY[]::uuid[]) AS agent_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'auth_item_keys'), ARRAY[]::uuid[]) AS auth_item_key_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'auths'), ARRAY[]::uuid[]) AS auth_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'colors'), ARRAY[]::uuid[]) AS color_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'items'), ARRAY[]::uuid[]) AS item_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'profiles'), ARRAY[]::uuid[]) AS profile_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'provider_keys'), ARRAY[]::uuid[]) AS provider_key_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'settings'), ARRAY[]::uuid[]) AS settings_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'thresholds'), ARRAY[]::uuid[]) AS threshold_ids
FROM setting_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX setting_drafts_mv_pk ON setting_drafts_mv (draft_id);

REFRESH MATERIALIZED VIEW setting_drafts_mv;
