-- Get document by ID for test verification
-- Returns document details for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_document_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_document_by_id_v4(
    input_document_id uuid
)
RETURNS TABLE (
    document_id uuid,
    name text,
    description text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id AS document_id,
        name,
        description,
        active,
        created_at,
        updated_at
    FROM documents
    WHERE id = input_document_id;
$$;