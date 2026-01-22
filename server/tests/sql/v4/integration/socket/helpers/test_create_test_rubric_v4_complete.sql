-- Create a test rubric for socket tests_entry
-- Returns rubric_id
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_rubric_v4(text, text, integer, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_rubric_v4(
    name text DEFAULT 'Test Rubric',
    description text DEFAULT 'Test Description',
    points integer DEFAULT 100,
    pass_points integer DEFAULT 70
)
RETURNS TABLE (
    rubric_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_rubric AS (
        INSERT INTO rubrics_resource DEFAULT VALUES
        RETURNING id
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (test_create_test_rubric_v4.name)
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (test_create_test_rubric_v4.description)
        RETURNING id
    ),
    points_resource_cte AS (
        INSERT INTO points_resource(value)
        VALUES (test_create_test_rubric_v4.points)
        ON CONFLICT (value) DO NOTHING
        RETURNING id
    ),
    points_lookup AS (
        SELECT id FROM points_resource WHERE value = test_create_test_rubric_v4.points LIMIT 1
    ),
    pass_points_resource_cte AS (
        INSERT INTO points_resource(value)
        VALUES (test_create_test_rubric_v4.pass_points)
        ON CONFLICT (value) DO NOTHING
        RETURNING id
    ),
    pass_points_lookup AS (
        SELECT id FROM points_resource WHERE value = test_create_test_rubric_v4.pass_points LIMIT 1
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
        SELECT nr.id, COALESCE(pr.id, pl.id), 'total'::type_rubric_points
        FROM new_rubric nr, points_resource_cte pr FULL OUTER JOIN points_lookup pl ON true
        RETURNING rubric_id
    ),
    rubric_pass_points_link AS (
        INSERT INTO rubric_points(rubric_id, point_id, type)
        SELECT nr.id, COALESCE(ppr.id, ppl.id), 'pass'::type_rubric_points
        FROM new_rubric nr, pass_points_resource_cte ppr FULL OUTER JOIN pass_points_lookup ppl ON true
        RETURNING rubric_id
    ),
    rubric_flag_link AS (
        INSERT INTO rubric_flags (rubric_id, flag_id, value)
        SELECT nr.id, af.id, true
        FROM new_rubric nr, active_flag af
        RETURNING rubric_id
    )
    SELECT nr.id as rubric_id
    FROM new_rubric nr;
$$;