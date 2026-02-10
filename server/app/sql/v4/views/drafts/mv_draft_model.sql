-- Materialized View: mv_draft_model
-- Per-artifact draft MV for model drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_draft_model'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_draft_model CASCADE;

CREATE MATERIALIZED VIEW mv_draft_model AS
WITH draft_links AS (
    SELECT draft_id, 'names'::resource_type AS resource_type, names_id::uuid AS resource_id FROM names_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'descriptions'::resource_type AS resource_type, descriptions_id::uuid AS resource_id FROM descriptions_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'values'::resource_type AS resource_type, values_id::uuid AS resource_id FROM values_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'providers'::resource_type AS resource_type, providers_id::uuid AS resource_id FROM providers_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'flags'::resource_type AS resource_type, flags_id::uuid AS resource_id FROM flags_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'departments'::resource_type AS resource_type, departments_id::uuid AS resource_id FROM departments_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'modalities'::resource_type AS resource_type, modalities_id::uuid AS resource_id FROM modalities_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'temperature_levels'::resource_type AS resource_type, temperature_levels_id::uuid AS resource_id FROM temperature_levels_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'pricing'::resource_type AS resource_type, pricing_id::uuid AS resource_id FROM pricing_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'reasoning_levels'::resource_type AS resource_type, reasoning_levels_id::uuid AS resource_id FROM reasoning_levels_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'qualities'::resource_type AS resource_type, qualities_id::uuid AS resource_id FROM qualities_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'voices'::resource_type AS resource_type, voices_id::uuid AS resource_id FROM voices_drafts_connection WHERE active = true
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
    COALESCE((SELECT ARRAY_AGG(re.instructions ORDER BY re.created_at ASC, re.id ASC) FROM regenerates_entry re WHERE re.draft_id = d.id AND re.active = true), ARRAY[]::text[]) AS regeneration_descriptions,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'::resource_type), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'::resource_type), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'values'::resource_type), ARRAY[]::uuid[]) AS value_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'providers'::resource_type), ARRAY[]::uuid[]) AS provider_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'::resource_type), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'::resource_type), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'modalities'::resource_type), ARRAY[]::uuid[]) AS modality_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'temperature_levels'::resource_type), ARRAY[]::uuid[]) AS temperature_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'pricing'::resource_type), ARRAY[]::uuid[]) AS pricing_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'reasoning_levels'::resource_type), ARRAY[]::uuid[]) AS reasoning_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'qualities'::resource_type), ARRAY[]::uuid[]) AS quality_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'voices'::resource_type), ARRAY[]::uuid[]) AS voice_ids
FROM drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
WHERE d.artifact = 'model'::artifact_type
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active
WITH NO DATA;

CREATE UNIQUE INDEX mv_draft_model_pk ON mv_draft_model (draft_id);

REFRESH MATERIALIZED VIEW mv_draft_model;
