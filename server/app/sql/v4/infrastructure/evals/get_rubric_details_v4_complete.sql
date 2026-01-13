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
           (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) as name,
           r.points,
           r.pass_points
    FROM rubrics r
    WHERE r.id = $1
$$;
