-- Materialized View: model_drafts_mv
-- Per-artifact draft MV for model drafts with denormalized resource IDs.

CREATE MATERIALIZED VIEW model_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM model_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM model_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM model_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'modalities'::text AS resource_type, modalities_id AS resource_id FROM model_drafts_modalities_connection WHERE active = true
    UNION ALL SELECT draft_id, 'models'::text AS resource_type, models_id AS resource_id FROM model_drafts_models_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM model_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'pricing'::text AS resource_type, pricing_id AS resource_id FROM model_drafts_pricing_connection WHERE active = true
    UNION ALL SELECT draft_id, 'providers'::text AS resource_type, providers_id AS resource_id FROM model_drafts_providers_connection WHERE active = true
    UNION ALL SELECT draft_id, 'qualities'::text AS resource_type, qualities_id AS resource_id FROM model_drafts_qualities_connection WHERE active = true
    UNION ALL SELECT draft_id, 'reasoning_levels'::text AS resource_type, reasoning_levels_id AS resource_id FROM model_drafts_reasoning_levels_connection WHERE active = true
    UNION ALL SELECT draft_id, 'temperature_levels'::text AS resource_type, temperature_levels_id AS resource_id FROM model_drafts_temperature_levels_connection WHERE active = true
    UNION ALL SELECT draft_id, 'values'::text AS resource_type, values_id AS resource_id FROM model_drafts_values_connection WHERE active = true
    UNION ALL SELECT draft_id, 'voices'::text AS resource_type, voices_id AS resource_id FROM model_drafts_voices_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'modalities'), ARRAY[]::uuid[]) AS modality_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'models'), ARRAY[]::uuid[]) AS model_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'pricing'), ARRAY[]::uuid[]) AS pricing_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'providers'), ARRAY[]::uuid[]) AS provider_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'qualities'), ARRAY[]::uuid[]) AS quality_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'reasoning_levels'), ARRAY[]::uuid[]) AS reasoning_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'temperature_levels'), ARRAY[]::uuid[]) AS temperature_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'values'), ARRAY[]::uuid[]) AS value_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'voices'), ARRAY[]::uuid[]) AS voice_ids
FROM model_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;
