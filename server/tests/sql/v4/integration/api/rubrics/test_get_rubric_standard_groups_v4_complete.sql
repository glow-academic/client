-- Get rubric standard groups for test verification
-- Returns standard groups ordered by name
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
    -- NOTE: standard_groups table doesn't have rubric_id column
    -- Standard groups are linked to rubrics via rubric_standard_groups table
    SELECT 
        sg.id AS standard_group_id,
        rsg.rubric_id,
        sg.name,
        sg.short_name,
        sg.description,
        sg.points,
        sg.pass_points,
        sg.created_at,
        sg.created_at AS updated_at
    FROM standard_groups sg
    JOIN rubric_standard_groups rsg ON rsg.standard_group_id = sg.id
    WHERE rsg.rubric_id = input_rubric_id
    ORDER BY sg.name;
$$;