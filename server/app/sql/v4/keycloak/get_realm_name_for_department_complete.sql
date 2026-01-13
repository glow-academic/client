-- Get realm name for a department: settings_id if dept has keys, else 'master'
-- Converted to PostgreSQL function
-- Simplified version matching get_login_data_complete.sql logic
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_realm_name_for_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_realm_name_for_department_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_realm_name_for_department_v4(
    department_id uuid
)
RETURNS TABLE (
    realm_name text
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    CASE 
        -- No department → master realm
        WHEN department_id IS NULL THEN 'master'::text
        -- Check if department-specific settings has keys
        WHEN EXISTS (
            SELECT 1 
            FROM department_settings ds
            JOIN setting_artifact s ON s.id = ds.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
            JOIN setting_auth_keys sak ON sak.settings_id = s.id AND sak.active = true
            WHERE ds.department_id = api_get_realm_name_for_department_v4.department_id AND ds.active = true
        ) THEN (
            -- Department settings has keys → use settings_id as realm
            SELECT s.id::text
            FROM department_settings ds
            JOIN setting_artifact s ON s.id = ds.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
            WHERE ds.department_id = api_get_realm_name_for_department_v4.department_id AND ds.active = true
            LIMIT 1
        )
        -- No keys in dept settings → use master realm
        ELSE 'master'::text
    END as realm_name
$$;