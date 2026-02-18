-- Materialized View: persona_drafts_mv
-- Per-artifact draft MV for persona drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'persona_drafts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS persona_drafts_mv CASCADE;

CREATE MATERIALIZED VIEW persona_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'colors'::text AS resource_type, colors_id AS resource_id FROM persona_drafts_colors_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM persona_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM persona_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'examples'::text AS resource_type, examples_id AS resource_id FROM persona_drafts_examples_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM persona_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'icons'::text AS resource_type, icons_id AS resource_id FROM persona_drafts_icons_connection WHERE active = true
    UNION ALL SELECT draft_id, 'instructions'::text AS resource_type, instructions_id AS resource_id FROM persona_drafts_instructions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM persona_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameter_fields'::text AS resource_type, parameter_fields_id AS resource_id FROM persona_drafts_parameter_fields_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameters'::text AS resource_type, parameters_id AS resource_id FROM persona_drafts_parameters_connection WHERE active = true
    UNION ALL SELECT draft_id, 'personas'::text AS resource_type, personas_id AS resource_id FROM persona_drafts_personas_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'colors'), ARRAY[]::uuid[]) AS color_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'examples'), ARRAY[]::uuid[]) AS example_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'icons'), ARRAY[]::uuid[]) AS icon_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'instructions'), ARRAY[]::uuid[]) AS instruction_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameter_fields'), ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameters'), ARRAY[]::uuid[]) AS parameter_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'personas'), ARRAY[]::uuid[]) AS persona_ids
FROM persona_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX persona_drafts_mv_pk ON persona_drafts_mv (draft_id);

REFRESH MATERIALIZED VIEW persona_drafts_mv;
