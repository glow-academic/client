-- Materialized View: invocation_drafts_mv
-- Per-artifact draft MV for benchmark bundle drafts with denormalized resource IDs.
-- Mirrors the resource arrays of invocation_mv.

CREATE MATERIALIZED VIEW invocation_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM invocation_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM invocation_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM invocation_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'keys'::text AS resource_type, keys_id AS resource_id FROM invocation_drafts_keys_connection WHERE active = true
    UNION ALL SELECT draft_id, 'model_flags'::text AS resource_type, model_flags_id AS resource_id FROM invocation_drafts_model_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'model_rubrics'::text AS resource_type, model_rubrics_id AS resource_id FROM invocation_drafts_model_rubrics_connection WHERE active = true
    UNION ALL SELECT draft_id, 'model_positions'::text AS resource_type, model_positions_id AS resource_id FROM invocation_drafts_model_positions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM invocation_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'reasoning_levels'::text AS resource_type, reasoning_levels_id AS resource_id FROM invocation_drafts_reasoning_levels_connection WHERE active = true
    UNION ALL SELECT draft_id, 'temperature_levels'::text AS resource_type, temperature_levels_id AS resource_id FROM invocation_drafts_temperature_levels_connection WHERE active = true
    UNION ALL SELECT draft_id, 'voices'::text AS resource_type, voices_id AS resource_id FROM invocation_drafts_voices_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'keys'), ARRAY[]::uuid[]) AS key_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'model_flags'), ARRAY[]::uuid[]) AS model_flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'model_rubrics'), ARRAY[]::uuid[]) AS model_rubric_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'model_positions'), ARRAY[]::uuid[]) AS model_position_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'reasoning_levels'), ARRAY[]::uuid[]) AS reasoning_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'temperature_levels'), ARRAY[]::uuid[]) AS temperature_level_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'voices'), ARRAY[]::uuid[]) AS voice_ids
FROM invocation_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;
