-- Get document by ID for test verification
-- Returns document details for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_document_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_document_by_id_v4(
    input_document_id uuid
)
RETURNS TABLE (
    document_id uuid,
    name text,
    type text,
    active boolean,
    file_path text,
    mime_type text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id AS document_id,
        name,
        type,
        active,
        file_path,
        mime_type,
        created_at,
        updated_at
    FROM documents
    WHERE id = input_document_id;
$$;

COMMIT;

