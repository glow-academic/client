-- Get default department FROM setting_artifact
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_default_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_default_department_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_default_department_v4()
RETURNS TABLE (
    department_id text
)
LANGUAGE sql
STABLE
AS $$
SELECT sdd.department_id::text
FROM setting_artifact s
JOIN settings_default_department sdd ON sdd.settings_id = s.id
WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'active' AND sf.value = true)
  AND sdd.active = true
LIMIT 1
$$;