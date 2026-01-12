-- Get department_id for a given settings_id
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infra_get_department_id_for_settings_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_get_department_id_for_settings_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION infra_get_department_id_for_settings_v4(
    settings_id uuid
)
RETURNS TABLE (
    department_id text
)
LANGUAGE sql
STABLE
AS $$
    SELECT ds.department_id::text
    FROM department_settings ds
    WHERE ds.settings_id = infra_get_department_id_for_settings_v4.settings_id 
      AND ds.active = true
    LIMIT 1;
$$;
