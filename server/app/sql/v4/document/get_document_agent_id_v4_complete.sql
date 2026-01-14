-- Get agent_id FROM document_artifact's domain
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_document_agent_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_document_agent_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_document_agent_id_v4(
    document_id uuid
)
RETURNS TABLE (
    agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT NULL::uuid
    FROM document_artifact doc
    
    
    WHERE doc.id = $1
    LIMIT 1
$$;
