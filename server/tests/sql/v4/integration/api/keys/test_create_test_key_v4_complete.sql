-- Create a test key for test setup
-- Returns key data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_key_v4(text, text, text, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_key_v4(
    key_name text,
    key_value text,
    key_description text DEFAULT 'Test key description',
    key_active boolean DEFAULT true
)
RETURNS TABLE (
    key_id uuid,
    name text,
    key text,
    description text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO keys(name, key, description, active)
    VALUES (
        key_name,
        key_value,
        key_description,
        key_active
    )
    RETURNING id AS key_id, name, key, description, active, created_at, updated_at;
$$;