-- Materialized View: field_drafts_mv
-- Per-artifact draft MV for field drafts with denormalized resource IDs.

CREATE MATERIALIZED VIEW field_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'conditional_parameters'::text AS resource_type, conditional_parameters_id AS resource_id FROM field_drafts_conditional_parameters_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM field_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM field_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'fields'::text AS resource_type, fields_id AS resource_id FROM field_drafts_fields_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM field_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM field_drafts_names_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'conditional_parameters'), ARRAY[]::uuid[]) AS conditional_parameter_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'fields'), ARRAY[]::uuid[]) AS field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids
FROM field_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;
