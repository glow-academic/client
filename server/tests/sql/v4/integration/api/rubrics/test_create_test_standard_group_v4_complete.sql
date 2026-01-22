-- Create a test standard group for test setup
-- Returns standard group data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_standard_group_v4(uuid, text, text, text, integer, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_standard_group_v4(
    input_rubric_id uuid,
    group_name text,
    group_short_name text,
    group_description text,
    group_points integer,
    group_pass_points integer
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
VOLATILE
AS $$
    -- NOTE: standard_groups table doesn't have rubric_id column
    -- Standard groups_entry are linked to rubrics via rubric_standard_groups_junction table
    -- This function creates a standard group without rubric link - tests_entry using this may need updating
    WITH new_group AS (
        INSERT INTO standard_groups_resource(name, short_name, description, points, pass_points)
        SELECT 
            group_name,
            group_short_name,
            group_description,
            group_points,
            group_pass_points
        RETURNING id AS standard_group_id, name, short_name, description, points, pass_points, created_at, created_at AS updated_at
    )
    SELECT 
        standard_group_id,
        input_rubric_id AS rubric_id,
        name,
        short_name,
        description,
        points,
        pass_points,
        created_at,
        updated_at
    FROM new_group;
$$;