-- Get template upload file path and document template args for rendering
-- Parameters: $1=document_id, $2=profile_id (uuid)
-- Returns active template for the document, or NULL if no active template exists
-- Note: Works even if d.template = false, as long as there's an active template
WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
)
SELECT 
    d.template,
    t.args as template_args,
    u.file_path,
    u.id::text as upload_id,
    d.name as document_name,
    ap.actor_name
FROM documents d
INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
INNER JOIN templates t ON t.id = dt.template_id
INNER JOIN uploads u ON u.id = t.upload_id
CROSS JOIN actor_profile ap
WHERE d.id = $1::uuid
ORDER BY dt.created_at DESC
LIMIT 1;

