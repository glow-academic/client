-- Create persona-department link for test setup
-- Returns link data for verification
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_persona_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_persona_department_link_v4(
    input_persona_id uuid,
    input_department_id uuid
)
RETURNS TABLE (
    persona_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO persona_departments_junction(persona_id, department_id, active, created_at)
    VALUES (
        test_create_persona_department_link_v4.input_persona_id,
        test_create_persona_department_link_v4.input_department_id,
        true,
        NOW()
    )
    RETURNING persona_id, department_id, active, created_at;
$$;
