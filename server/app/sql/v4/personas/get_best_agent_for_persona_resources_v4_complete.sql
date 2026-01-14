-- Get best agent for persona resource generation based on tool-to-resource matching
-- Selects agent with smallest set difference between agent's tools and requested resources
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_best_agent_for_persona_resources_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_best_agent_for_persona_resources_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_get_best_agent_for_persona_resources_v4(
    profile_id uuid,
    resource_types text[]
)
RETURNS TABLE (
    agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        resource_types AS resource_types
),
-- Get profile's primary department
profile_primary_department AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    LIMIT 1
),
-- Determine department to use
selected_department AS (
    SELECT 
        (SELECT department_id FROM profile_primary_department) as department_id
),
-- Get all user's departments (for filtering agents)
user_departments AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.active = true
),
-- Get eligible agents (active, available to user's departments, have persona artifact)
eligible_agents AS (
    SELECT DISTINCT a.id as agent_id
    FROM agent_artifact a
    CROSS JOIN params p
    CROSS JOIN selected_department sd
    -- Must be active
    WHERE EXISTS (SELECT 1 FROM agent_flags af WHERE af.agent_id = a.id AND af.type = 'active'::type_agent_flags 
          AND af.value = true
    )
    -- Must have persona artifact (via agent_domains -> domain_artifacts)
    AND EXISTS (
        SELECT 1 
        
        WHERE NULL::uuid = a.id
          AND NULL::artifacts = 'persona'::artifacts
    )
    -- Must be available to user's departments (via agent_departments) or cross-department
    AND (
        -- Agent linked to user's departments
        EXISTS (
            SELECT 1 FROM agent_departments ad
            JOIN user_departments ud ON ad.department_id = ud.department_id
            WHERE NULL::uuid = a.id AND ad.active = true
        )
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (
            SELECT 1 FROM agent_departments ad2 
            WHERE ad2.agent_id = a.id AND ad2.active = true
        )
    )
),
-- For each eligible agent, get their tool resources
agent_tool_resources AS (
    SELECT 
        ea.agent_id,
        COALESCE(
            ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL),
            ARRAY[]::text[]
        ) as tool_resources
    FROM eligible_agents ea
    LEFT JOIN agent_tools at ON at.agent_id = ea.agent_id AND at.active = true
    LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
    LEFT JOIN resource_tools rt ON rt.tool_id = t.id
    GROUP BY ea.agent_id
),
-- Calculate set difference for each agent: (agent's tool resources) - (requested resource_types)
-- Count unmatched resources (set difference size)
agent_scores AS (
    SELECT 
        atr.agent_id,
        atr.tool_resources,
        -- Calculate set difference: tool_resources - requested resource_types
        ARRAY(
            SELECT unnest(atr.tool_resources)
            EXCEPT
            SELECT unnest(p.resource_types)
        ) as unmatched_resources,
        -- Count unmatched resources (smaller is better)
        ARRAY_LENGTH(
            ARRAY(
                SELECT unnest(atr.tool_resources)
                EXCEPT
                SELECT unnest(p.resource_types)
            ),
            1
        ) as unmatched_count
    FROM agent_tool_resources atr
    CROSS JOIN params p
    -- Only consider agents that have ALL requested resources
    WHERE p.resource_types <@ atr.tool_resources  -- <@ means "is contained in"
),
-- Get department preference for tie-breaking
agent_department_preference AS (
    SELECT 
        ascores.agent_id,
        ascores.unmatched_count,
        -- Prefer department-specific agents over cross-department (0 = dept-specific, 1 = cross-dept)
        CASE 
            WHEN sd.department_id IS NOT NULL 
                 AND EXISTS (
                     SELECT 1 FROM agent_departments ad
                     WHERE NULL::uuid = ascores.agent_id 
                       AND ad.department_id = sd.department_id 
                       AND ad.active = true
                 )
            THEN 0
            ELSE 1
        END as dept_preference
    FROM agent_scores ascores
    CROSS JOIN selected_department sd
),
-- Select best agent: smallest unmatched_count, then prefer department-specific
best_agent AS (
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.unmatched_count ASC,  -- Smallest set difference first
        adp.dept_preference ASC,  -- Department-specific over cross-department
        adp.agent_id ASC          -- Deterministic tie-breaker
    LIMIT 1
)
SELECT 
    ba.agent_id
FROM best_agent ba
$$;
