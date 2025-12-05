-- Get template upload file path and document template args for rendering
-- Parameters: $1=document_id
-- Returns active template for the document, or NULL if document.template is false or no active template exists
SELECT 
    d.template,
    dtu.args as template_args,
    u.file_path,
    u.id::text as upload_id
FROM documents d
INNER JOIN document_template_uploads dtu ON dtu.document_id = d.id AND dtu.active = true
INNER JOIN uploads u ON u.id = dtu.upload_id
WHERE d.id = $1::uuid AND d.template = true
ORDER BY dtu.created_at DESC
LIMIT 1;

