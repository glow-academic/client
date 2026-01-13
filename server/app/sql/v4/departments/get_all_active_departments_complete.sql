-- Get all active departments
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_all_active_departments_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_all_active_departments_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_all_active_departments_v4()
RETURNS TABLE (
    id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT d.id FROM department d WHERE EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
$$;