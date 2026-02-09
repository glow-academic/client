-- Get agent's model information with proper API key resolution
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_agent_model_info_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_model_info_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_agent_model_info_v4(
    agent_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    model_name text,
    provider text,
    base_url text,
    api_key text
)
LANGUAGE sql
STABLE
AS $$
SELECT
    m.value as model_name,
    COALESCE(n_prov.name, '') as provider,
    COALESCE(m.endpoint, '') as base_url,
    m.key as api_key
FROM agent_artifact a
INNER JOIN agent_agents_junction aaj ON aaj.agent_id = a.id AND aaj.active = true
INNER JOIN agents_resource ar ON ar.id = aaj.agents_id
INNER JOIN models_resource m ON m.id = ar.model_id
-- Get provider via provider_models_junction
LEFT JOIN provider_models_junction pmj ON pmj.model_id = m.id
LEFT JOIN provider_artifact pr_prov ON pr_prov.id = pmj.provider_id
LEFT JOIN provider_names_junction pn_prov ON pn_prov.provider_id = pr_prov.id
LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
WHERE a.id = agent_id
  AND EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
LIMIT 1
$$;