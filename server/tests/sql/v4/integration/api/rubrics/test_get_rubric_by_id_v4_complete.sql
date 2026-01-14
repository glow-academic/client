-- Get rubric by ID for test verification
-- Returns rubric details for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_rubric_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_rubric_by_id_v4(
    input_rubric_id uuid
)
RETURNS TABLE (
    rubric_id uuid,
    name text,
    description text,
    points integer,
    pass_points integer,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        r.id AS rubric_id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) AS name,
        (SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1) AS description,
        (SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total'::type_rubric_points LIMIT 1) AS points,
        (SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'pass'::type_rubric_points LIMIT 1) AS pass_points,
        EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource fl ON rf.flag_id = fl.id WHERE rf.rubric_id = r.id AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = TRUE) AS active,
        r.created_at,
        r.updated_at
    FROM rubrics_resource r
    WHERE r.id = input_rubric_id;
$$;