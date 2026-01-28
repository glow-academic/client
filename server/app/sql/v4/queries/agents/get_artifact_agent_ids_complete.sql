-- Get artifact agent IDs in a single pass
-- Computes general_agent_id for ALL artifact types using artifact_resources_relation
-- Parameters: profile_id (uuid), user_department_ids (uuid[])
-- Returns: artifact_type -> general_agent_id mapping

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_artifact_agent_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_artifact_agent_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_artifact_agent_ids_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for artifact agent ID mapping
CREATE TYPE types.q_get_artifact_agent_ids_v4_item AS (
    artifact text,
    general_agent_id uuid
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_artifact_agent_ids_v4(
    profile_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_artifact_agent_ids_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH
-- Get all artifact -> resource mappings
artifact_resources AS (
    SELECT artifact, ARRAY_AGG(resource::text) as required_resources
    FROM artifact_resources_relation
    GROUP BY artifact
),
-- Get eligible agents (active, in user's departments)
eligible_agents AS (
    SELECT DISTINCT
        a.id as agent_id,
        a.updated_at
    FROM agent_artifact a
    WHERE EXISTS (
        SELECT 1 FROM agent_flags_junction af
        JOIN flags_resource f ON af.flag_id = f.id
        WHERE af.agent_id = a.id
          AND f.name = 'agent_active'
          AND af.value = true
    )
    AND (
        -- Agent is cross-department (no department restrictions)
        NOT EXISTS (
            SELECT 1 FROM agent_departments_junction ad
            WHERE ad.agent_id = a.id AND ad.active = true
        )
        OR
        -- Agent matches user's departments
        EXISTS (
            SELECT 1 FROM agent_departments_junction ad
            WHERE ad.agent_id = a.id
              AND ad.active = true
              AND ad.department_id = ANY(user_department_ids)
        )
    )
),
-- Get tool resources for each eligible agent
agent_tool_resources AS (
    SELECT
        ea.agent_id,
        ea.updated_at,
        COALESCE(
            ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL),
            ARRAY[]::text[]
        ) as tool_resources
    FROM eligible_agents ea
    LEFT JOIN agent_tools_junction at ON at.agent_id = ea.agent_id AND at.active = true
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id AND rt.active = true
    GROUP BY ea.agent_id, ea.updated_at
),
-- Score and select best agent per artifact
scored_agents AS (
    SELECT
        ar.artifact::text as artifact,
        atr.agent_id,
        atr.updated_at,
        -- Agent must have ALL required resources for the artifact
        CASE
            WHEN ar.required_resources <@ atr.tool_resources THEN 1
            ELSE 0
        END as has_all_resources,
        -- Count of matching resources (for tiebreaking)
        COALESCE(
            CARDINALITY(
                ARRAY(SELECT unnest(ar.required_resources) INTERSECT SELECT unnest(atr.tool_resources))
            ),
            0
        ) as matching_count,
        -- Count of resources in tool set (prefer specialized agents with fewer extra resources)
        CARDINALITY(atr.tool_resources) as total_tool_count
    FROM artifact_resources ar
    CROSS JOIN agent_tool_resources atr
),
ranked_agents AS (
    SELECT
        artifact,
        agent_id,
        ROW_NUMBER() OVER (
            PARTITION BY artifact
            ORDER BY
                has_all_resources DESC,
                matching_count DESC,
                total_tool_count ASC,  -- Prefer more specialized agents
                updated_at DESC,
                agent_id ASC
        ) as rank
    FROM scored_agents
    WHERE has_all_resources = 1
)
SELECT COALESCE(
    ARRAY_AGG(
        (ra.artifact, ra.agent_id)::types.q_get_artifact_agent_ids_v4_item
        ORDER BY ra.artifact
    ),
    ARRAY[]::types.q_get_artifact_agent_ids_v4_item[]
) as items
FROM ranked_agents ra
WHERE ra.rank = 1;
$$;
