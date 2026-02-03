-- Get artifact agent IDs in a single pass
-- Computes general_agent_id for ALL artifact types using TWO paths:
--   1. Resources path: artifact_resources_relation (for persona, scenario, training, etc.)
--   2. Bindings path: artifact_view_relation -> view_entry_relation -> bindings (for attempt, test)
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
-- ============================================================================
-- PATH 1: Resources path (artifact_resources_relation)
-- For artifacts like: persona, scenario, simulation, training, etc.
-- ============================================================================

-- Get all artifact -> resource mappings
artifact_resources AS (
    SELECT artifact, ARRAY_AGG(resource::text) as required_resources
    FROM artifact_resources_relation
    GROUP BY artifact
),

-- ============================================================================
-- PATH 2: Bindings path (artifact_view_relation -> view_entry_relation)
-- For artifacts like: attempt, test
-- ============================================================================

-- Get all artifact -> entry mappings via views
-- Only include entries that actually have tool bindings (intersection with bound entries)
artifact_entries AS (
    SELECT
        avr.artifact,
        ARRAY_AGG(DISTINCT ver.entry::text) FILTER (
            WHERE b.creatable = true
            AND EXISTS (
                SELECT 1 FROM tool_bindings_junction tbj
                WHERE tbj.binding_id = b.id AND tbj.active = true
            )
        ) as required_entries
    FROM artifact_view_relation avr
    JOIN view_entry_relation ver ON ver.view = avr.view
    JOIN bindings_resource b ON b.entry = ver.entry
    GROUP BY avr.artifact
),

-- ============================================================================
-- ELIGIBLE AGENTS (shared by both paths)
-- ============================================================================

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

-- ============================================================================
-- AGENT CAPABILITIES
-- ============================================================================

-- Get tool resources for each eligible agent (for resources path)
-- Path: agent_tools_junction -> tool_tools_junction -> resource_tools_relation
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
    LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = at.tool_id
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = ttj.tool_id AND rt.active = true
    GROUP BY ea.agent_id, ea.updated_at
),

-- Get tool entries for each eligible agent (for bindings path)
-- Path: agent_tools_junction -> tools_resource -> tool_tools_junction -> tool_bindings_junction -> bindings_resource
agent_tool_entries AS (
    SELECT
        ea.agent_id,
        ea.updated_at,
        COALESCE(
            ARRAY_AGG(DISTINCT b.entry::text) FILTER (WHERE b.entry IS NOT NULL AND b.creatable = true),
            ARRAY[]::text[]
        ) as tool_entries
    FROM eligible_agents ea
    LEFT JOIN agent_tools_junction atj ON atj.agent_id = ea.agent_id AND atj.active = true
    LEFT JOIN tools_resource tr ON tr.id = atj.tool_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    LEFT JOIN tool_bindings_junction tbj ON tbj.tool_id = ttj.tool_id AND tbj.active = true
    LEFT JOIN bindings_resource b ON b.id = tbj.binding_id
    GROUP BY ea.agent_id, ea.updated_at
),

-- ============================================================================
-- SCORING AND RANKING
-- ============================================================================

-- Score agents for resources path artifacts
scored_agents_resources AS (
    SELECT
        ar.artifact::text as artifact,
        atr.agent_id,
        atr.updated_at,
        CASE
            WHEN ar.required_resources <@ atr.tool_resources THEN 1
            ELSE 0
        END as has_all_required,
        COALESCE(
            CARDINALITY(
                ARRAY(SELECT unnest(ar.required_resources) INTERSECT SELECT unnest(atr.tool_resources))
            ),
            0
        ) as matching_count,
        CARDINALITY(atr.tool_resources) as total_count
    FROM artifact_resources ar
    CROSS JOIN agent_tool_resources atr
),

-- Score agents for bindings path artifacts
-- For bindings path, we return ALL agents that cover ANY required entries
scored_agents_bindings AS (
    SELECT
        ae.artifact::text as artifact,
        ate.agent_id,
        ate.updated_at,
        -- For bindings path, any coverage counts as valid
        CASE
            WHEN CARDINALITY(ARRAY(SELECT unnest(ae.required_entries) INTERSECT SELECT unnest(ate.tool_entries))) > 0 THEN 1
            ELSE 0
        END as has_all_required,
        COALESCE(
            CARDINALITY(
                ARRAY(SELECT unnest(ae.required_entries) INTERSECT SELECT unnest(ate.tool_entries))
            ),
            0
        ) as matching_count,
        CARDINALITY(ate.tool_entries) as total_count
    FROM artifact_entries ae
    CROSS JOIN agent_tool_entries ate
    -- Only include artifacts that use bindings path (not in resources path)
    WHERE NOT EXISTS (SELECT 1 FROM artifact_resources ar WHERE ar.artifact = ae.artifact)
),

-- Rank agents for resources path (pick ONE best agent per artifact)
ranked_agents_resources AS (
    SELECT
        artifact,
        agent_id,
        ROW_NUMBER() OVER (
            PARTITION BY artifact
            ORDER BY
                has_all_required DESC,
                matching_count DESC,
                total_count ASC,  -- Prefer more specialized agents
                updated_at DESC,
                agent_id ASC
        ) as rank
    FROM scored_agents_resources
    WHERE has_all_required = 1
),

-- For bindings path, include ALL agents with any matching entries
matched_agents_bindings AS (
    SELECT DISTINCT
        artifact,
        agent_id
    FROM scored_agents_bindings
    WHERE has_all_required = 1  -- This means matching_count > 0 for bindings path
),

-- Combine: resources path (rank=1 only) + bindings path (all matching)
final_agents AS (
    SELECT artifact, agent_id FROM ranked_agents_resources WHERE rank = 1
    UNION
    SELECT artifact, agent_id FROM matched_agents_bindings
)

SELECT COALESCE(
    ARRAY_AGG(
        (fa.artifact, fa.agent_id)::types.q_get_artifact_agent_ids_v4_item
        ORDER BY fa.artifact, fa.agent_id
    ),
    ARRAY[]::types.q_get_artifact_agent_ids_v4_item[]
) as items
FROM final_agents fa;
$$;
