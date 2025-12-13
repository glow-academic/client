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
create_or_get_template AS (
    -- Create or get template if template_upload_id is provided
    INSERT INTO templates (name, upload_id, args, created_at, updated_at)
    SELECT 
        COALESCE((SELECT name FROM documents WHERE id = $1::uuid), 'Template'),
        $10::uuid,
        COALESCE($11::jsonb, '{}'::jsonb),
        NOW(),
        NOW()
    WHERE $10::uuid IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM templates t 
          WHERE t.upload_id = $10::uuid AND t.args = COALESCE($11::jsonb, '{}'::jsonb)
      )
    RETURNING id as template_id
),
get_existing_template AS (
    -- Get existing template if it exists
    SELECT id as template_id
    FROM templates
    WHERE upload_id = $10::uuid 
      AND args = COALESCE($11::jsonb, '{}'::jsonb)
    LIMIT 1
),
template_id AS (
    SELECT template_id FROM create_or_get_template
    UNION ALL
    SELECT template_id FROM get_existing_template
    WHERE $10::uuid IS NOT NULL
    LIMIT 1
),
deactivate_previous_templates AS (
    -- Deactivate all previous templates if new one is provided
    UPDATE document_templates
    SET active = false, updated_at = NOW()
    WHERE document_id = $1::uuid
      AND active = true
      AND $10::uuid IS NOT NULL
),
update_template_link AS (
    -- Update or insert template link if template_id is available
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        ti.template_id,
        true,
        NOW(),
        NOW()
    FROM template_id ti
    WHERE $10::uuid IS NOT NULL
    ON CONFLICT (document_id, template_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_template_link AS (
    -- Delete template link if template_upload_id is NULL (removing template)
    DELETE FROM document_templates 
    WHERE document_id = $1::uuid 
    AND $10::uuid IS NULL
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
),
deactivate_parameters AS (
    -- Soft-delete removed parameters (set active = false for parameters not in new list)
    UPDATE parameter_documents
    SET active = false, updated_at = NOW()
    WHERE document_id = $1::uuid
    AND active = true
    AND (
        COALESCE(array_length($12::text[], 1), 0) = 0
        OR parameter_id NOT IN (SELECT unnest($12::text[])::uuid)
    )
),
link_parameters AS (
    -- Insert or reactivate parameter links if provided (array is never NULL, but may be empty)
    INSERT INTO parameter_documents (parameter_id, document_id, active, created_at, updated_at)
    SELECT 
        param_id::uuid,
        $1::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($12::text[]) as param_id
    WHERE COALESCE(array_length($12::text[], 1), 0) > 0
    ON CONFLICT (parameter_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
backfill_document_fields AS (
    -- Backfill document_fields for linked parameters (use default field)
    INSERT INTO document_fields (document_id, field_id, active, created_at, updated_at)
    SELECT DISTINCT
        pd.document_id,
        pf.field_id,
        TRUE,
        NOW(),
        NOW()
    FROM parameter_documents pd
    JOIN parameter_fields pf ON pf.parameter_id = pd.parameter_id AND pf.active = TRUE AND pf.default = TRUE
    WHERE pd.document_id = $1::uuid
    AND pd.active = TRUE
    AND NOT EXISTS (
        SELECT 1 FROM document_fields df
        WHERE df.document_id = pd.document_id
        AND df.field_id = pf.field_id
        AND df.active = TRUE
    )
    ON CONFLICT (document_id, field_id) DO UPDATE SET
        active = TRUE,
        updated_at = NOW()
)
SELECT document_id FROM update_document
