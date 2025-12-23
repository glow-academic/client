-- Get template mapping for a document
-- Parameters: $1=document_id (uuid)
-- Returns: template_mapping (jsonb)
-- Returns mapping of upload_id to template metadata
SELECT 
    COALESCE(
        jsonb_object_agg(
            t.upload_id::text,
            jsonb_build_object(
                'template_args', t.args,
                'active', dt.active,
                'created_at', dt.created_at::text,
                'updated_at', dt.updated_at::text
            )
        ),
        '{}'::jsonb
    ) as template_mapping
FROM document_templates dt
JOIN templates t ON t.id = dt.template_id
WHERE dt.document_id = $1::uuid

