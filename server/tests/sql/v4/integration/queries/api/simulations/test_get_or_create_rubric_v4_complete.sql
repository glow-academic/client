-- Get or create a test rubric for test setup
-- Returns rubric_id for use in tests_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_or_create_rubric_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_or_create_rubric_v4()
RETURNS TABLE (
    rubric_id uuid,
    name text,
    description text,
    points integer,
    pass_points integer,
    active boolean
)
LANGUAGE sql
VOLATILE
AS $$
    WITH name_resource AS (
        INSERT INTO names_resource(name)
        VALUES ('Test Rubric')
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    name_lookup AS (
        SELECT id FROM names_resource WHERE name = 'Test Rubric' LIMIT 1
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES ('Test')
        ON CONFLICT (description) DO NOTHING
        RETURNING id
    ),
    description_lookup AS (
        SELECT id FROM descriptions_resource WHERE description = 'Test' LIMIT 1
    ),
    points_resource_cte AS (
        INSERT INTO points_resource(value)
        VALUES (100)
        ON CONFLICT (value) DO NOTHING
        RETURNING id
    ),
    points_lookup AS (
        SELECT id FROM points_resource WHERE value = 100 LIMIT 1
    ),
    pass_points_resource_cte AS (
        INSERT INTO points_resource(value)
        VALUES (70)
        ON CONFLICT (value) DO NOTHING
        RETURNING id
    ),
    pass_points_lookup AS (
        SELECT id FROM points_resource WHERE value = 70 LIMIT 1
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    existing_rubric AS (
        SELECT r.id, 
               (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) as name,
               (SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1) as description,
               (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total'::point_type LIMIT 1) as points,
               (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'pass'::point_type LIMIT 1) as pass_points,
               EXISTS (SELECT 1 FROM rubric_flags_junction rf JOIN flags_resource fl ON rf.flag_id = fl.id WHERE rf.rubric_id = r.id AND fl.name = 'active'  AND rf.value = TRUE) as active
        FROM rubrics_resource r
        LIMIT 1
    ),
    new_rubric AS (
        INSERT INTO rubrics_resource DEFAULT VALUES
        RETURNING id
    ),
    new_rubric_filtered AS (
        SELECT nr.id FROM new_rubric nr
        WHERE NOT EXISTS (SELECT 1 FROM existing_rubric)
    ),
    new_rubric_name_link AS (
        INSERT INTO rubric_names_junction(rubric_id, name_id)
        SELECT nrf.id, COALESCE(nr3.id, nl.id)
        FROM new_rubric_filtered nrf, name_resource nr3 FULL OUTER JOIN name_lookup nl ON true
        RETURNING rubric_id
    ),
    new_rubric_description_link AS (
        INSERT INTO rubric_descriptions_junction(rubric_id, description_id)
        SELECT nrf.id, COALESCE(dr.id, dl.id)
        FROM new_rubric_filtered nrf, description_resource dr FULL OUTER JOIN description_lookup dl ON true
        RETURNING rubric_id
    ),
    new_rubric_points_link AS (
        INSERT INTO rubric_points_junction(rubric_id, point_id, type)
        SELECT nrf.id, COALESCE(pr.id, pl.id), 'total'::point_type
        FROM new_rubric_filtered nrf, points_resource_cte pr FULL OUTER JOIN points_lookup pl ON true
        RETURNING rubric_id
    ),
    new_rubric_pass_points_link AS (
        INSERT INTO rubric_points_junction(rubric_id, point_id, type)
        SELECT nrf.id, COALESCE(ppr.id, ppl.id), 'pass'::point_type
        FROM new_rubric_filtered nrf, pass_points_resource_cte ppr FULL OUTER JOIN pass_points_lookup ppl ON true
        RETURNING rubric_id
    ),
    new_rubric_flag_link AS (
        INSERT INTO rubric_flags_junction (rubric_id, flag_id, value)
        SELECT nrf.id, af.id, true
        FROM new_rubric_filtered nrf, active_flag af
        RETURNING rubric_id
    )
    SELECT 
        er.id as rubric_id, 
        er.name, 
        er.description, 
        er.points, 
        er.pass_points, 
        er.active
    FROM existing_rubric er
    UNION ALL
    SELECT 
        nrf.id as rubric_id,
        (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = nrf.id LIMIT 1) as name,
        (SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = nrf.id LIMIT 1) as description,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = nrf.id AND rp.type = 'total'::point_type LIMIT 1) as points,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = nrf.id AND rp.type = 'pass'::point_type LIMIT 1) as pass_points,
        EXISTS (SELECT 1 FROM rubric_flags_junction rf JOIN flags_resource fl ON rf.flag_id = fl.id WHERE rf.rubric_id = nrf.id AND fl.name = 'active'  AND rf.value = TRUE) as active
    FROM new_rubric_filtered nrf
    LIMIT 1;
$$;