-- Create a test persona for test setup
-- Returns persona_id for use in tests
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_persona_v4(text, text, text, text, boolean, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_persona_v4(
    persona_name text DEFAULT 'Test Persona',
    description text DEFAULT 'Test Description',
    color text DEFAULT '#000000',
    icon text DEFAULT 'user',
    active boolean DEFAULT true,
    instructions text DEFAULT NULL
)
RETURNS TABLE (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    active boolean,
    instructions text,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO personas(
        name,
        description,
        color,
        icon,
        active,
        instructions
    )
    VALUES (
        COALESCE(test_create_test_persona_v4.persona_name, 'Test Persona'),
        COALESCE(test_create_test_persona_v4.description, 'Test Description'),
        COALESCE(test_create_test_persona_v4.color, '#000000'),
        COALESCE(test_create_test_persona_v4.icon, 'user'),
        COALESCE(test_create_test_persona_v4.active, true),
        test_create_test_persona_v4.instructions
    )
    RETURNING id, name, description, color, icon, active, instructions, created_at;
$$;