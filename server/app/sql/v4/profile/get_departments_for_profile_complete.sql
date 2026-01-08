-- Get departments for a profile
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_departments_for_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_departments_for_profile_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_departments_for_profile_v4(
    profile_id uuid
)
RETURNS TABLE (
    id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT DISTINCT d.id
FROM departments d
JOIN profile_departments pd ON pd.department_id = d.id
WHERE pd.profile_id = profile_id AND EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = true)
$$;