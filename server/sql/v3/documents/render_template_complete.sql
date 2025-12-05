-- Get template upload file path and document template args for rendering
-- Parameters: $1=document_id
-- Returns active template for the document, or NULL if no active template exists
-- Note: Works even if d.template = false, as long as there's an active template upload
SELECT 
    d.template,
    dtu.args as template_args,
    u.file_path,
    u.id::text as upload_id
FROM documents d
INNER JOIN document_template_uploads dtu ON dtu.document_id = d.id AND dtu.active = true
INNER JOIN uploads u ON u.id = dtu.upload_id
WHERE d.id = $1::uuid
ORDER BY dtu.created_at DESC
LIMIT 1;

