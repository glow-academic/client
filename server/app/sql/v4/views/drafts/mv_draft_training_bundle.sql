-- Materialized View: mv_draft_training_bundle
-- Per-artifact draft MV for training bundle drafts with denormalized resource IDs.
-- Mirrors the resource arrays of mv_training_bundle.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_draft_training_bundle'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_draft_training_bundle CASCADE;

CREATE MATERIALIZED VIEW mv_draft_training_bundle AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::resource_type AS resource_type, departments_id::uuid AS resource_id FROM departments_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'personas'::resource_type AS resource_type, personas_id::uuid AS resource_id FROM personas_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'documents'::resource_type AS resource_type, documents_id::uuid AS resource_id FROM documents_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameter_fields'::resource_type AS resource_type, parameter_fields_id::uuid AS resource_id FROM parameter_fields_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameters'::resource_type AS resource_type, parameters_id::uuid AS resource_id FROM parameters_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'fields'::resource_type AS resource_type, fields_id::uuid AS resource_id FROM fields_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'questions'::resource_type AS resource_type, questions_id::uuid AS resource_id FROM questions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'options'::resource_type AS resource_type, options_id::uuid AS resource_id FROM options_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'videos'::resource_type AS resource_type, videos_id::uuid AS resource_id FROM videos_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'images'::resource_type AS resource_type, images_id::uuid AS resource_id FROM images_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'templates'::resource_type AS resource_type, templates_id::uuid AS resource_id FROM templates_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'problem_statements'::resource_type AS resource_type, problem_statements_id::uuid AS resource_id FROM problem_statements_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'objectives'::resource_type AS resource_type, objectives_id::uuid AS resource_id FROM objectives_drafts_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'::resource_type), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'personas'::resource_type), ARRAY[]::uuid[]) AS persona_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'documents'::resource_type), ARRAY[]::uuid[]) AS document_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameter_fields'::resource_type), ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameters'::resource_type), ARRAY[]::uuid[]) AS parameter_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'fields'::resource_type), ARRAY[]::uuid[]) AS field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'questions'::resource_type), ARRAY[]::uuid[]) AS question_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'options'::resource_type), ARRAY[]::uuid[]) AS option_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'videos'::resource_type), ARRAY[]::uuid[]) AS video_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'images'::resource_type), ARRAY[]::uuid[]) AS image_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'templates'::resource_type), ARRAY[]::uuid[]) AS template_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'problem_statements'::resource_type), ARRAY[]::uuid[]) AS problem_statement_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'objectives'::resource_type), ARRAY[]::uuid[]) AS objective_ids
FROM drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
WHERE d.artifact = 'training'::artifact_type
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active
WITH NO DATA;

CREATE UNIQUE INDEX mv_draft_training_bundle_pk ON mv_draft_training_bundle (draft_id);

REFRESH MATERIALIZED VIEW mv_draft_training_bundle;
