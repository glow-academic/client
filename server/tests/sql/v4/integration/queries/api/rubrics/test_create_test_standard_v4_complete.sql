-- Create a test standard for test setup
-- Returns standard data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_standard_v4(uuid, text, text, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_standard_v4(
    input_standard_group_id uuid,
    standard_name text,
    standard_description text,
    standard_points integer
)
RETURNS TABLE (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points integer,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH call_record AS (
        INSERT INTO calls_entry (id, external_call_id, arguments_raw, completed, created_at, updated_at)
        VALUES (
            uuidv7(),
            'test_create_standard_' || uuidv7()::text,
            jsonb_build_object(
                'standard_group_id', input_standard_group_id::text,
                'name', standard_name,
                'description', standard_description,
                'points', standard_points
            )::text,
            true,
            NOW(),
            NOW()
        )
        RETURNING id as call_id
    ),
    new_standard AS (
        INSERT INTO standards_resource(standard_group_id, name, description, points, active, generated, mcp)
        SELECT
            input_standard_group_id,
            standard_name,
            standard_description,
            standard_points,
            true,
            false,
            false
        FROM call_record cr
        RETURNING id, standard_group_id, name, description, points, created_at
    ),
    link_standard_call AS (
        INSERT INTO standards_calls_connection(standards_id, call_id, active, created_at)
        SELECT ns.id, cr.call_id, true, NOW()
        FROM new_standard ns
        CROSS JOIN call_record cr
        RETURNING standards_id
    )
    SELECT id AS standard_id, standard_group_id, name, description, points, created_at FROM new_standard;
$$;
