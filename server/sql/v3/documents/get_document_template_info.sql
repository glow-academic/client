-- Get parent document template info for dynamic document creation
-- Parameters: $1=parent_document_id (uuid)
-- Returns: template_html, template_args (schema), classify_agent_id, document_agent_id, name, description
SELECT 
    u.file_path,
    dtu.args as template_args,
    d.classify_agent_id::text,
    d.document_agent_id::text,
    d.name,
    d.description
FROM documents d
INNER JOIN document_template_uploads dtu ON dtu.document_id = d.id AND dtu.active = true
INNER JOIN uploads u ON u.id = dtu.upload_id
WHERE d.id = $1::uuid
ORDER BY dtu.created_at DESC
LIMIT 1;

