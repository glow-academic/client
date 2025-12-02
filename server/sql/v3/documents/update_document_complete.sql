-- Update document with department links and parameter items in a single transaction
-- Parameters: $1=documentId, $2=name (nullable text), $3=type, $4=active (nullable boolean), $5=department_id (nullable uuid), $6=parameter_item_ids (nullable text array), $7=classify_agent_id (nullable uuid), $8=document_agent_id (nullable uuid)
WITH update_document AS (
    UPDATE documents
    SET 
        name = COALESCE($2, name),
        type = $3,
        active = COALESCE($4, active),
        classify_agent_id = COALESCE($7::uuid, classify_agent_id),
        document_agent_id = COALESCE($8::uuid, document_agent_id),
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
    SELECT $1::uuid, $5::uuid, true, NOW(), NOW()
    WHERE $5::uuid IS NOT NULL
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
    FROM UNNEST($6::text[]) as param_item_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (document_id, parameter_item_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
)
SELECT document_id FROM update_document

