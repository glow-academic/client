-- Check if document department link exists for test verification
-- Returns boolean indicating existence
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_document_department_link_exists_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_document_department_link_exists_v4(
    input_document_id uuid,
    input_department_id uuid
)
RETURNS TABLE (
    link_exists boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS(
        SELECT 1
        FROM document_departments
        WHERE document_id = input_document_id
          AND department_id = input_department_id
          AND active = true
    ) AS link_exists;
$$;