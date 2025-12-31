-- Get parent document template info for dynamic document creation
-- Parameters: $1=parent_document_id (uuid)
-- Returns: template_html, template_args (schema), classify_agent_id, document_agent_id, name, description
SELECT 
    u.file_path,
    t.args as template_args,
    d.classify_agent_id::text,
    d.document_agent_id::text,
    d.name,
    d.description
FROM documents d
INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
INNER JOIN templates t ON t.id = dt.template_id
INNER JOIN uploads u ON u.id = t.upload_id
WHERE d.id = $1::uuid
ORDER BY dt.created_at DESC
LIMIT 1;

