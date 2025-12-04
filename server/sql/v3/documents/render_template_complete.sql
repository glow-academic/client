-- Get template upload file path and document template args for rendering
-- Parameters: $1=document_id, $2=profile_id
WITH document_template AS (
    SELECT 
        d.template,
        d.template_args,
        u.file_path,
        u.id as upload_id
    FROM documents d
    INNER JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    INNER JOIN uploads u ON u.id = du.upload_id
    WHERE d.id = $1::uuid
    LIMIT 1
)
SELECT 
    dt.template,
    dt.template_args,
    dt.file_path,
    dt.upload_id::text
FROM document_template dt;

