-- Materialized View: draft_document_mv
-- Per-artifact draft MV for document drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'draft_document_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS draft_document_mv CASCADE;

CREATE MATERIALIZED VIEW draft_document_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM document_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM document_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'documents'::text AS resource_type, documents_id AS resource_id FROM document_drafts_documents_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM document_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'images'::text AS resource_type, images_id AS resource_id FROM document_drafts_images_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM document_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameter_fields'::text AS resource_type, parameter_fields_id AS resource_id FROM document_drafts_parameter_fields_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameters'::text AS resource_type, parameters_id AS resource_id FROM document_drafts_parameters_connection WHERE active = true
    UNION ALL SELECT draft_id, 'texts'::text AS resource_type, texts_id AS resource_id FROM document_drafts_texts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'uploads'::text AS resource_type, uploads_id AS resource_id FROM document_drafts_uploads_connection WHERE active = true
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
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'documents'), ARRAY[]::uuid[]) AS document_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'images'), ARRAY[]::uuid[]) AS image_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameter_fields'), ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameters'), ARRAY[]::uuid[]) AS parameter_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'texts'), ARRAY[]::uuid[]) AS text_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'uploads'), ARRAY[]::uuid[]) AS upload_ids
FROM document_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX draft_document_mv_pk ON draft_document_mv (draft_id);

REFRESH MATERIALIZED VIEW draft_document_mv;
