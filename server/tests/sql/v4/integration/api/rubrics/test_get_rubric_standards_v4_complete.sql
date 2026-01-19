-- Get rubric standards for test verification
-- Returns standards ordered by name
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_rubric_standards_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_rubric_standards_v4(
    input_standard_group_id uuid
)
RETURNS TABLE (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points integer,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id AS standard_id,
        standard_group_id,
        name,
        description,
        points,
        created_at,
        created_at AS updated_at
    FROM standards_resource
    WHERE standard_group_id = input_standard_group_id
    ORDER BY name;
$$;
