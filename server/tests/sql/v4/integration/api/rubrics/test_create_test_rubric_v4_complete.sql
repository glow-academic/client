-- Create a test rubric for test setup
-- Returns rubric data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_rubric_v4(text, text, integer, integer, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_rubric_v4(
    rubric_name text,
    rubric_description text,
    rubric_points integer,
    rubric_pass_points integer,
    rubric_active boolean
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
VOLATILE
AS $$
    WITH new_rubric AS (
        INSERT INTO rubrics_resource(created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id, created_at, updated_at
    ),
    rubric_artifact_link AS (
        INSERT INTO rubric_artifacts(rubric_id, artifact, created_at, updated_at)
        SELECT nr.id, 'rubric'::artifacts, NOW(), NOW()
        FROM new_rubric nr
        RETURNING rubric_id
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (rubric_name)
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (rubric_description)
        RETURNING id
    ),
    points_resource_cte AS (
        INSERT INTO points_resource(value)
        VALUES (rubric_points)
        RETURNING id
    ),
    pass_points_resource_cte AS (
        INSERT INTO points_resource(value)
        VALUES (rubric_pass_points)
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    rubric_name_link AS (
        INSERT INTO rubric_names(rubric_id, name_id)
        SELECT nr.id, nrr.id
        FROM new_rubric nr, name_resource nrr
        RETURNING rubric_id
    ),
    rubric_description_link AS (
        INSERT INTO rubric_descriptions(rubric_id, description_id)
        SELECT nr.id, dr.id
        FROM new_rubric nr, description_resource dr
        RETURNING rubric_id
    ),
    rubric_points_link AS (
        INSERT INTO rubric_points(rubric_id, point_id, type)
        SELECT nr.id, pr.id, 'total'::type_rubric_points
        FROM new_rubric nr, points_resource_cte pr
        RETURNING rubric_id
    ),
    rubric_pass_points_link AS (
        INSERT INTO rubric_points(rubric_id, point_id, type)
        SELECT nr.id, ppr.id, 'pass'::type_rubric_points
        FROM new_rubric nr, pass_points_resource_cte ppr
        RETURNING rubric_id
    ),
    rubric_flag_link AS (
        INSERT INTO rubric_flags(rubric_id, flag_id, type, value)
        SELECT nr.id, af.id, 'active'::type_rubric_flags, rubric_active
        FROM new_rubric nr, active_flag af
        RETURNING rubric_id
    )
    SELECT 
        nr.id AS rubric_id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = nr.id LIMIT 1) AS name,
        (SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = nr.id LIMIT 1) AS description,
        (SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = nr.id AND rp.type = 'total'::type_rubric_points LIMIT 1) AS points,
        (SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = nr.id AND rp.type = 'pass'::type_rubric_points LIMIT 1) AS pass_points,
        EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource fl ON rf.flag_id = fl.id WHERE rf.rubric_id = nr.id AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = TRUE) AS active,
        nr.created_at,
        nr.updated_at
    FROM new_rubric nr;
$$;