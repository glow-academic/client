-- Get persona generation context (domain_id and agent_id)
-- Returns domain_id and agent_id for persona generation based on persona's department or profile's primary department
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_persona_generation_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_generation_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_generation_context_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    domain_id uuid,
    agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        persona_id AS persona_id,
        draft_id AS draft_id,
        profile_id AS profile_id
),
-- Get persona's department (if persona_id provided)
persona_department AS (
    SELECT pd.department_id
    FROM params p
    JOIN persona_departments pd ON pd.persona_id = p.persona_id AND pd.active = true
    WHERE p.persona_id IS NOT NULL
    LIMIT 1
),
-- Get profile's primary department (if only draft_id provided)
profile_primary_department AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.persona_id IS NULL
    LIMIT 1
),
-- Determine department to use
selected_department AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM persona_department),
            (SELECT department_id FROM profile_primary_department)
        ) as department_id
),
-- Find domain for persona artifact
-- Domains link to artifacts via domain_artifacts junction table
-- We need to find a domain that has artifact = 'persona'
-- Priority: any domain with persona artifact (domains are not department-specific)
default_persona_domain AS (
    SELECT d.id as domain_id
    FROM domains d
    JOIN domain_artifacts da ON da.domain_id = d.id AND da.artifact = 'persona'::artifacts
    LIMIT 1
),
-- Get final domain_id
final_domain AS (
    SELECT 
        (SELECT domain_id FROM default_persona_domain) as domain_id
),
-- Get agent_id from domain via agent_domains junction table
domain_agent AS (
    SELECT ad.agent_id
    FROM final_domain fd
    JOIN agent_domains ad ON ad.domain_id = fd.domain_id
    WHERE fd.domain_id IS NOT NULL
    LIMIT 1
)
SELECT 
    fd.domain_id,
    da.agent_id
FROM final_domain fd
LEFT JOIN domain_agent da ON true
$$;
