-- Check if document parameter item link exists for test verification
-- Returns boolean indicating existence

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_document_parameter_item_link_exists_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_document_parameter_item_link_exists_v4(
    input_document_id uuid,
    input_parameter_item_id uuid
)
RETURNS TABLE (
    link_exists boolean
)
LANGUAGE sql
STABLE
AS $$
    -- NOTE: document_parameter_items table does not exist in current schema
    -- This function returns false - tests using this may need updating
    SELECT false AS link_exists;
$$;

COMMIT;

