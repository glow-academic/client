-- Get document template info from upload_id
-- Parameters: $1=upload_id (uuid)
-- Returns: document_id, template (boolean), template_args (JSONB schema), department_ids (array)
-- Handles two cases:
--   1. Upload is a regular document upload (via document_uploads)
--   2. Upload is a template upload (via document_templates → templates)
WITH regular_document_upload AS (
    -- Case 1: Upload is linked to a document via document_uploads
    -- Also get template_args if document has template=true
    SELECT 
        du.document_id,
        d.template,
        COALESCE(
            (SELECT t.args 
             FROM document_templates dt 
             JOIN templates t ON t.id = dt.template_id 
             WHERE dt.document_id = d.id AND dt.active = true 
             ORDER BY dt.created_at DESC 
             LIMIT 1),
            '{}'::jsonb
        ) as template_args,
        (SELECT ARRAY_AGG(dd.department_id::text) 
         FROM document_departments dd 
         WHERE dd.document_id = d.id AND dd.active = true) as department_ids
    FROM document_uploads du
    JOIN documents d ON d.id = du.document_id
    WHERE du.upload_id = $1::uuid
      AND du.active = true
    LIMIT 1
),
template_upload AS (
    -- Case 2: Upload is a template upload (via document_templates → templates)
    SELECT 
        dt.document_id,
        d.template,
        t.args as template_args,
        (SELECT ARRAY_AGG(dd.department_id::text) 
         FROM document_departments dd 
         WHERE dd.document_id = d.id AND dd.active = true) as department_ids
    FROM templates t
    JOIN document_templates dt ON dt.template_id = t.id AND dt.active = true
    JOIN documents d ON d.id = dt.document_id
    WHERE t.upload_id = $1::uuid
    ORDER BY dt.created_at DESC
    LIMIT 1
)
-- Return template info from either case (prefer regular document upload if both exist)
SELECT 
    COALESCE(rdu.document_id, tu.document_id)::text as document_id,
    COALESCE(rdu.template, tu.template, false) as template,
    COALESCE(tu.template_args, rdu.template_args, '{}'::jsonb) as template_args,
    COALESCE(tu.department_ids, rdu.department_ids, ARRAY[]::text[]) as department_ids
FROM regular_document_upload rdu
FULL OUTER JOIN template_upload tu ON true
WHERE rdu.document_id IS NOT NULL OR tu.document_id IS NOT NULL;

