-- Get distinct parameter_ids from fields
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_scenario_parameter_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_scenario_parameter_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_scenario_parameter_ids_v4(
    field_ids uuid[]
)
RETURNS TABLE (
    parameter_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT DISTINCT pf.parameter_id 
    FROM fields f
    JOIN parameter_fields pf ON pf.field_id = f.field_id
    WHERE f.id = ANY($1)
$$;
