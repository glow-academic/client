-- Get rubric standard groups for test verification
-- Returns standard groups ordered by name

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_rubric_standard_groups_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_rubric_standard_groups_v4(
    input_rubric_id uuid
)
RETURNS TABLE (
    standard_group_id uuid,
    rubric_id uuid,
    name text,
    short_name text,
    description text,
    points integer,
    pass_points integer,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id AS standard_group_id,
        rubric_id,
        name,
        short_name,
        description,
        points,
        pass_points,
        created_at,
        updated_at
    FROM standard_groups
    WHERE rubric_id = input_rubric_id
    ORDER BY name;
$$;

COMMIT;

