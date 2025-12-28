SELECT
    t.upload_id,
    t.id as template_id,
    t.args as template_args,
    dt.active,
    dt.created_at,
    dt.updated_at
FROM document_templates dt
JOIN templates t ON t.id = dt.template_id
WHERE dt.document_id = $1::uuid
ORDER BY dt.created_at DESC
