-- Get rubric details (id, name, points, pass_points)
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_get_rubric_details_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_get_rubric_details_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_evals_get_rubric_details_v4(
    rubric_id uuid
)
RETURNS TABLE (
    id uuid,
    name text,
    points integer,
    pass_points integer
)
LANGUAGE sql
STABLE
AS $$
    SELECT r.id, 
           (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.names_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) as name,
           (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON p.id = rp.points_id WHERE rp.rubric_id = r.id AND p.type = 'total'::point_type LIMIT 1)::integer as points,
           (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON p.id = rp.points_id WHERE rp.rubric_id = r.id AND p.type = 'pass'::point_type LIMIT 1)::integer as pass_points
    FROM rubric_artifact r
    WHERE r.id = $1
$$;
