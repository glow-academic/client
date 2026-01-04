-- Create a document department link for test setup
-- Returns link data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_document_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_document_department_link_v4(
    document_id uuid,
    department_id uuid
)
RETURNS TABLE (
    document_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO document_departments(document_id, department_id, active, created_at, updated_at)
    VALUES (
        test_create_document_department_link_v4.document_id,
        test_create_document_department_link_v4.department_id,
        true,
        NOW(),
        NOW()
    )
    RETURNING document_id, department_id, active, created_at, updated_at;
$$;