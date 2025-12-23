-- Bulk update documents with department links and parameter items in a single transaction
-- Parameters: $1=documentIds (uuid array), $2=type, $3=department_id (nullable uuid), $4=field_ids (nullable text array)
WITH update_documents AS (
    UPDATE documents
    SET 
        updated_at = NOW()
    WHERE id = ANY($1::uuid[])
    RETURNING id::text as document_id
),
replace_departments AS (
    -- Delete all existing department links for all documents
    DELETE FROM document_departments WHERE document_id = ANY($1::uuid[])
),
link_departments AS (
    -- Insert new department links for all documents if department_id provided
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT 
        doc_id::uuid,
        $3::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($1::uuid[]) as doc_id
    WHERE $3::uuid IS NOT NULL
    ON CONFLICT (document_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_fields AS (
    -- Delete all existing field links for all documents
    DELETE FROM document_fields WHERE document_id = ANY($1::uuid[])
),
link_fields AS (
    -- Insert new field links for all documents if provided (array is never NULL, but may be empty)
    INSERT INTO document_fields (document_id, field_id, active, created_at, updated_at)
    SELECT 
        doc_id::uuid,
        field_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($1::uuid[]) as doc_id
    CROSS JOIN UNNEST($4::text[]) as field_id
    WHERE COALESCE(array_length($4::text[], 1), 0) > 0
    ON CONFLICT (document_id, field_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
)
SELECT COUNT(*) as updated_count FROM update_documents

