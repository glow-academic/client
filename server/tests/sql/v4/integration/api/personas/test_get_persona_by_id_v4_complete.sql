-- Get persona by ID for test verification
-- Returns persona data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_persona_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_persona_by_id_v4(
    input_persona_id uuid
)
RETURNS TABLE (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    active boolean,
    instructions text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id as persona_id,
        name,
        description,
        color,
        icon,
        active,
        instructions,
        created_at,
        updated_at
    FROM personas
    WHERE id = test_get_persona_by_id_v4.input_persona_id;
$$;