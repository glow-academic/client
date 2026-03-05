-- Get all active departments that need organizations
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infra_get_departments_for_org_sync_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_get_departments_for_org_sync_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION infra_get_departments_for_org_sync_v4()
RETURNS TABLE (
    department_id uuid,
    department_name text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.department_id = d.id LIMIT 1) as department_name
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flags_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND f.value = true)
    ORDER BY d.created_at
$$;
