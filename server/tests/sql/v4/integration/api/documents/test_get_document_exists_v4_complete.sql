-- Check if document exists for test verification
-- Returns boolean indicating existence

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_document_exists_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_document_exists_v4(
    input_document_id uuid
)
RETURNS TABLE (
    document_exists boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS(
        SELECT 1
        FROM documents
        WHERE id = input_document_id
    ) AS document_exists;
$$;

COMMIT;

