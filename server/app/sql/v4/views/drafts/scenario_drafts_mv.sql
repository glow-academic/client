-- Materialized View: scenario_drafts_mv
-- Per-artifact draft MV for scenario drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'scenario_drafts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS scenario_drafts_mv CASCADE;

CREATE MATERIALIZED VIEW scenario_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM scenario_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM scenario_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'documents'::text AS resource_type, documents_id AS resource_id FROM scenario_drafts_documents_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM scenario_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'images'::text AS resource_type, images_id AS resource_id FROM scenario_drafts_images_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM scenario_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'objectives'::text AS resource_type, objectives_id AS resource_id FROM scenario_drafts_objectives_connection WHERE active = true
    UNION ALL SELECT draft_id, 'options'::text AS resource_type, options_id AS resource_id FROM scenario_drafts_options_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameter_fields'::text AS resource_type, parameter_fields_id AS resource_id FROM scenario_drafts_parameter_fields_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameters'::text AS resource_type, parameters_id AS resource_id FROM scenario_drafts_parameters_connection WHERE active = true
    UNION ALL SELECT draft_id, 'personas'::text AS resource_type, personas_id AS resource_id FROM scenario_drafts_personas_connection WHERE active = true
    UNION ALL SELECT draft_id, 'problem_statements'::text AS resource_type, problem_statements_id AS resource_id FROM scenario_drafts_problem_statements_connection WHERE active = true
    UNION ALL SELECT draft_id, 'questions'::text AS resource_type, questions_id AS resource_id FROM scenario_drafts_questions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenarios'::text AS resource_type, scenarios_id AS resource_id FROM scenario_drafts_scenarios_connection WHERE active = true
    UNION ALL SELECT draft_id, 'videos'::text AS resource_type, videos_id AS resource_id FROM scenario_drafts_videos_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'documents'), ARRAY[]::uuid[]) AS document_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'images'), ARRAY[]::uuid[]) AS image_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'objectives'), ARRAY[]::uuid[]) AS objective_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'options'), ARRAY[]::uuid[]) AS option_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameter_fields'), ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameters'), ARRAY[]::uuid[]) AS parameter_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'personas'), ARRAY[]::uuid[]) AS persona_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'problem_statements'), ARRAY[]::uuid[]) AS problem_statement_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'questions'), ARRAY[]::uuid[]) AS question_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenarios'), ARRAY[]::uuid[]) AS scenario_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'videos'), ARRAY[]::uuid[]) AS video_ids
FROM scenario_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX scenario_drafts_mv_pk ON scenario_drafts_mv (draft_id);

REFRESH MATERIALIZED VIEW scenario_drafts_mv;
