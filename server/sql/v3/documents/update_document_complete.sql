-- Update document with department links and parameter items in a single transaction
-- Parameters: $1=documentId, $2=name (nullable text), $3=active (nullable boolean), $4=department_id (nullable uuid), $5=parameter_item_ids (nullable text array), $6=classify_agent_id (nullable uuid), $7=document_agent_id (nullable uuid), $8=template (nullable boolean), $9=template_args (nullable jsonb)
WITH update_document AS (
    UPDATE documents
    SET 
        name = COALESCE($2, name),
        active = COALESCE($3, active),
        classify_agent_id = COALESCE($6::uuid, classify_agent_id),
        document_agent_id = COALESCE($7::uuid, document_agent_id),
        template = COALESCE($8, template),
        template_args = COALESCE($9::jsonb, template_args),
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as document_id
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM document_departments WHERE document_id = $1::uuid
),
link_department AS (
    -- Insert new department link if provided
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT $1::uuid, $4::uuid, true, NOW(), NOW()
    WHERE $4::uuid IS NOT NULL
    ON CONFLICT (document_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_parameter_items AS (
    -- Delete all existing parameter item links
    DELETE FROM document_parameter_items WHERE document_id = $1::uuid
),
link_parameter_items AS (
    -- Insert new parameter item links if provided (array is never NULL, but may be empty)
    INSERT INTO document_parameter_items (document_id, parameter_item_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        param_item_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($5::text[]) as param_item_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (document_id, parameter_item_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
)
SELECT document_id FROM update_document

