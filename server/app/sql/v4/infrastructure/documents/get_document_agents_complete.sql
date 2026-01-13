-- Get document agents and basic info
-- Returns classify_agent_id, document_agent_id, name, description for document inheritance
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_documents_get_document_agents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_documents_get_document_agents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_documents_get_document_agents_v4(
    document_id uuid
)
RETURNS TABLE (
    classify_agent_id uuid,
    document_agent_id uuid,
    name text,
    description text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        NULL::uuid as classify_agent_id,
        ad.agent_id as document_agent_id,
        (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = doc.id LIMIT 1) as name,
        (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = doc.id LIMIT 1) as description
    FROM document doc
    LEFT JOIN document_agent_domains dad ON dad.document_id = doc.id
    LEFT JOIN agent_domains ad ON ad.domain_id = dad.agent_domain_id
    WHERE doc.id = $1
    LIMIT 1
$$;
