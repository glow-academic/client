-- Create a test document for test setup
-- Returns document data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_document_v4(text, text, boolean, text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_document_v4(
    document_name text,
    document_type text,
    document_active boolean,
    document_file_path text DEFAULT '/test/path.pdf',
    document_mime_type text DEFAULT 'application/pdf'
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
VOLATILE
AS $$
    INSERT INTO documents(name, type, active, file_path, mime_type, created_at, updated_at)
    VALUES (
        document_name,
        document_type,
        document_active,
        document_file_path,
        document_mime_type,
        NOW(),
        NOW()
    )
    RETURNING id AS document_id, name, type, active, file_path, mime_type, created_at, updated_at;
$$;

COMMIT;

