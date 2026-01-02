-- Create a test document for test setup
-- Returns document data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_document_v4(text, text, boolean, text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_document_v4(
    document_name text,
    document_description text DEFAULT 'Test document description',
    document_active boolean DEFAULT true
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
VOLATILE
AS $$
    INSERT INTO documents(name, description, active, created_at, updated_at)
    VALUES (
        document_name,
        document_description,
        document_active,
        NOW(),
        NOW()
    )
    RETURNING id AS document_id, name, description, active, created_at, updated_at;
$$;

COMMIT;

