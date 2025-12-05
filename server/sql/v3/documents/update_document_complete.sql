-- Update document with department links and parameter items in a single transaction
-- Parameters: $1=documentId, $2=name (nullable text), $3=description (nullable text), $4=active (nullable boolean), $5=template (nullable boolean), $6=department_id (nullable uuid), $7=field_ids (nullable text array), $8=classify_agent_id (nullable uuid), $9=document_agent_id (nullable uuid), $10=template_upload_id (nullable uuid), $11=template_args (nullable jsonb)
WITH update_document AS (
    UPDATE documents
    SET 
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        active = COALESCE($4, active),
        template = COALESCE($5, template),  -- Only set if explicitly provided, otherwise keep existing value
        classify_agent_id = COALESCE($8::uuid, classify_agent_id),
        document_agent_id = COALESCE($9::uuid, document_agent_id),
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as document_id
),
update_template_upload AS (
    -- Update or insert template upload junction if template_upload_id is provided
    INSERT INTO document_template_uploads (
        document_id,
        upload_id,
        args,
        active,
        created_at,
        updated_at
    )
    SELECT 
        $1::uuid,
        $10::uuid,
        COALESCE($11::jsonb, '{}'::jsonb),
        true,
        NOW(),
        NOW()
    WHERE $10::uuid IS NOT NULL
    ON CONFLICT (document_id, upload_id) DO UPDATE SET
        args = EXCLUDED.args,
        active = true,
        updated_at = NOW()
),
delete_template_upload AS (
    -- Delete template upload junction if template_upload_id is NULL (removing template)
    DELETE FROM document_template_uploads 
    WHERE document_id = $1::uuid 
    AND ($10::uuid IS NULL OR upload_id != $10::uuid)
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM document_departments WHERE document_id = $1::uuid
),
link_department AS (
    -- Insert new department link if provided
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT $1::uuid, $6::uuid, true, NOW(), NOW()
    WHERE $6::uuid IS NOT NULL
    ON CONFLICT (document_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_fields AS (
    -- Delete all existing field links
    DELETE FROM document_fields WHERE document_id = $1::uuid
),
link_fields AS (
    -- Insert new field links if provided (array is never NULL, but may be empty)
    INSERT INTO document_fields (document_id, field_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($7::text[]) as field_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
    ON CONFLICT (document_id, field_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
)
SELECT document_id FROM update_document
