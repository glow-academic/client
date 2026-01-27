-- Create a document parameter item link for test setup
-- Returns link data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_document_parameter_item_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_document_parameter_item_link_v4(
    document_id uuid,
    parameter_item_id uuid
)
RETURNS TABLE (
    document_id uuid,
    parameter_item_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    -- NOTE: document_parameter_items table does not exist in current schema
    -- This function returns empty result - view_tests_entry using this may need updating
    SELECT NULL::uuid AS document_id, NULL::uuid AS parameter_item_id, NULL::boolean AS active, NULL::timestamptz AS created_at WHERE false;
$$;
