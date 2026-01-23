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
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH call_record AS (
        INSERT INTO calls_entry(id, external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at)
        VALUES (
            uuidv7(),
            'test_create_key_' || uuidv7()::text,
            NULL,
            NULL,
            jsonb_build_object('key_name', key_name, 'key_description', key_description, 'key_active', key_active)::text,
            true,
            NOW(),
            NOW()
        )
        RETURNING id as call_id
    ),
    new_key AS (
        INSERT INTO keys_resource(key_id, key, name, description, active, created_at, call_id, generated, mcp)
        SELECT
            uuidv7(),
            key_value,
            key_name,
            COALESCE(key_description, 'Test key description'),
            COALESCE(key_active, true),
            NOW(),
            cr.call_id,
            false,
            false
        FROM call_record cr
        RETURNING id, name, key, description, active, created_at
    )
    SELECT
        nk.id AS key_id,
        nk.name,
        nk.key,
        nk.description,
        nk.active,
        nk.created_at
    FROM new_key nk;
$$;
