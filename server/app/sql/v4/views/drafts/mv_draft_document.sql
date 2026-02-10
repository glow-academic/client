-- Materialized View: mv_draft_document
-- Per-artifact draft MV for document drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_draft_document'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_draft_document CASCADE;

CREATE MATERIALIZED VIEW mv_draft_document AS
WITH draft_links AS (
    SELECT draft_id, 'names'::resource_type AS resource_type, names_id::uuid AS resource_id FROM names_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::resource_type AS resource_type, descriptions_id::uuid AS resource_id FROM descriptions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::resource_type AS resource_type, flags_id::uuid AS resource_id FROM flags_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::resource_type AS resource_type, departments_id::uuid AS resource_id FROM departments_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameter_fields'::resource_type AS resource_type, parameter_fields_id::uuid AS resource_id FROM parameter_fields_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'uploads'::resource_type AS resource_type, uploads_id::uuid AS resource_id FROM uploads_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'images'::resource_type AS resource_type, images_id::uuid AS resource_id FROM images_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'texts'::resource_type AS resource_type, texts_id::uuid AS resource_id FROM texts_drafts_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'::resource_type), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'::resource_type), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'::resource_type), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'::resource_type), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameter_fields'::resource_type), ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'uploads'::resource_type), ARRAY[]::uuid[]) AS upload_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'images'::resource_type), ARRAY[]::uuid[]) AS image_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'texts'::resource_type), ARRAY[]::uuid[]) AS text_ids
FROM drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
WHERE d.artifact = 'document'::artifact_type
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active
WITH NO DATA;

CREATE UNIQUE INDEX mv_draft_document_pk ON mv_draft_document (draft_id);

REFRESH MATERIALIZED VIEW mv_draft_document;
