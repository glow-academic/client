-- Get domain artifact from agent_id
-- Returns artifact type for developer instruction rendering
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_developer_instructions_get_domain_artifact_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_developer_instructions_get_domain_artifact_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_developer_instructions_get_domain_artifact_v4(
    agent_id uuid
)
RETURNS TABLE (
    artifact text
)
LANGUAGE sql
STABLE
AS $$
    SELECT da.artifact::text
    FROM agent_domains ad
    JOIN domain_artifacts da ON da.domain_id = ad.domain_id
    WHERE ad.agent_id = $1
    LIMIT 1
$$;
