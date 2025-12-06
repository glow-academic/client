-- Get template upload file path and document template args for rendering
-- Parameters: $1=document_id
-- Returns active template for the document, or NULL if no active template exists
-- Note: Works even if d.template = false, as long as there's an active template
SELECT 
    d.template,
    t.args as template_args,
    u.file_path,
    u.id::text as upload_id
FROM documents d
INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
INNER JOIN templates t ON t.id = dt.template_id
INNER JOIN uploads u ON u.id = t.upload_id
WHERE d.id = $1::uuid
ORDER BY dt.created_at DESC
LIMIT 1;

