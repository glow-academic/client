-- Get department_id from run_id
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_get_department_from_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_get_department_from_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_evals_get_department_from_run_v4(
    run_id uuid
)
RETURNS TABLE (
    department_id text
)
LANGUAGE sql
STABLE
AS $$
    SELECT d.id::text as department_id
    FROM runs r
    JOIN profile_departments pd ON pd.profile_id = r.profile_id AND pd.active = true
    JOIN departments_resource d ON d.id = pd.department_id AND d.active = true
    WHERE r.id = $1
    LIMIT 1
$$;
