-- Materialized View: document_drafts_mv
-- Per-artifact draft MV for document drafts with denormalized resource IDs.

CREATE MATERIALIZED VIEW document_drafts_mv AS
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
    d.group_id,
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
