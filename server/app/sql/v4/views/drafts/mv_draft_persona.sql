-- Materialized View: mv_draft_persona
-- Per-artifact draft MV for persona drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_draft_persona'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_draft_persona CASCADE;

CREATE MATERIALIZED VIEW mv_draft_persona AS
WITH draft_links AS (
    SELECT draft_id, 'names'::resource_type AS resource_type, names_id::uuid AS resource_id FROM names_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'descriptions'::resource_type AS resource_type, descriptions_id::uuid AS resource_id FROM descriptions_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'colors'::resource_type AS resource_type, colors_id::uuid AS resource_id FROM colors_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'icons'::resource_type AS resource_type, icons_id::uuid AS resource_id FROM icons_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'instructions'::resource_type AS resource_type, instructions_id::uuid AS resource_id FROM instructions_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'flags'::resource_type AS resource_type, flags_id::uuid AS resource_id FROM flags_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'departments'::resource_type AS resource_type, departments_id::uuid AS resource_id FROM departments_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'parameter_fields'::resource_type AS resource_type, parameter_fields_id::uuid AS resource_id FROM parameter_fields_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'examples'::resource_type AS resource_type, examples_id::uuid AS resource_id FROM examples_drafts_connection WHERE active = true
    UNION ALL
    SELECT draft_id, 'parameters'::resource_type AS resource_type, parameters_id::uuid AS resource_id FROM parameters_drafts_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'colors'::resource_type), ARRAY[]::uuid[]) AS color_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'icons'::resource_type), ARRAY[]::uuid[]) AS icon_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'instructions'::resource_type), ARRAY[]::uuid[]) AS instruction_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'::resource_type), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'::resource_type), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameter_fields'::resource_type), ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'examples'::resource_type), ARRAY[]::uuid[]) AS example_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameters'::resource_type), ARRAY[]::uuid[]) AS parameter_ids
FROM drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
WHERE d.artifact = 'persona'::artifact_type
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active
WITH NO DATA;

CREATE UNIQUE INDEX mv_draft_persona_pk ON mv_draft_persona (draft_id);

REFRESH MATERIALIZED VIEW mv_draft_persona;
