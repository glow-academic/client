-- Get template upload file path and document template args for rendering
-- Parameters: $1=document_id, $2=profile_id
WITH document_template AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM document_template_uploads dtu WHERE dtu.document_id = d.id AND dtu.active = true) THEN true
            ELSE false
        END as template,
        dtu.args as template_args,
        u.file_path,
        u.id as upload_id
    FROM documents d
    LEFT JOIN document_template_uploads dtu ON dtu.document_id = d.id AND dtu.active = true
    LEFT JOIN uploads u ON u.id = dtu.upload_id
    WHERE d.id = $1::uuid
    ORDER BY dtu.created_at DESC
    LIMIT 1
)
SELECT 
    dt.template,
    dt.template_args,
    dt.file_path,
    dt.upload_id::text
FROM document_template dt
WHERE dt.template = true;

