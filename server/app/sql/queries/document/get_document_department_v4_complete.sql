-- Get department_id FROM document_artifact
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_document_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_document_department_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_document_department_v4(
    document_id uuid
)
RETURNS TABLE (
    department_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT departments_id FROM document_departments_junction WHERE document_departments_junction.document_id = $1 AND document_departments_junction.active = true LIMIT 1
$$;
