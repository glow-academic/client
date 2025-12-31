-- Create a document parameter item link for test setup
-- Returns link data for assertions

BEGIN;

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
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO document_parameter_items(document_id, parameter_item_id, active, created_at, updated_at)
    VALUES (
        test_create_document_parameter_item_link_v4.document_id,
        test_create_document_parameter_item_link_v4.parameter_item_id,
        true,
        NOW(),
        NOW()
    )
    RETURNING document_id, parameter_item_id, active, created_at, updated_at;
$$;

COMMIT;

