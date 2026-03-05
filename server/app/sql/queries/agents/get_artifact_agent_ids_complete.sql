-- Get artifact agent IDs in a single pass
-- Computes general_agent_id for ALL artifact types using TWO paths:
--   1. Resources path: inline VALUES table (for persona, scenario, training, etc.)
--   2. Bindings path: JSONB parameter -> bindings (for attempt, test)
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
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    p_artifact_entries jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    items types.q_get_artifact_agent_ids_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH
-- ============================================================================
-- PATH 1: Resources path (inline VALUES table)
-- For artifacts like: persona, scenario, simulation, training, etc.
-- ============================================================================

-- Get all artifact -> resource mappings
artifact_resources AS (
    SELECT artifact, ARRAY_AGG(resource) as required_resources
    FROM (VALUES
        ('agent'::artifact_type, 'agents'::text),
        ('agent'::artifact_type, 'departments'::text),
        ('agent'::artifact_type, 'descriptions'::text),
        ('agent'::artifact_type, 'flags'::text),
        ('agent'::artifact_type, 'instructions'::text),
        ('agent'::artifact_type, 'models'::text),
        ('agent'::artifact_type, 'names'::text),
        ('agent'::artifact_type, 'prompts'::text),
        ('agent'::artifact_type, 'reasoning_levels'::text),
        ('agent'::artifact_type, 'temperature_levels'::text),
        ('agent'::artifact_type, 'tools'::text),
        ('agent'::artifact_type, 'voices'::text),
        ('auth'::artifact_type, 'auths'::text),
        ('auth'::artifact_type, 'departments'::text),
        ('auth'::artifact_type, 'descriptions'::text),
        ('auth'::artifact_type, 'flags'::text),
        ('auth'::artifact_type, 'items'::text),
        ('auth'::artifact_type, 'names'::text),
        ('auth'::artifact_type, 'protocols'::text),
        ('auth'::artifact_type, 'slugs'::text),
        ('cohort'::artifact_type, 'cohorts'::text),
        ('cohort'::artifact_type, 'departments'::text),
        ('cohort'::artifact_type, 'descriptions'::text),
        ('cohort'::artifact_type, 'flags'::text),
        ('cohort'::artifact_type, 'names'::text),
        ('cohort'::artifact_type, 'simulation_positions'::text),
        ('cohort'::artifact_type, 'simulations'::text),
        ('department'::artifact_type, 'departments'::text),
        ('department'::artifact_type, 'descriptions'::text),
        ('department'::artifact_type, 'flags'::text),
        ('department'::artifact_type, 'names'::text),
        ('department'::artifact_type, 'settings'::text),
        ('document'::artifact_type, 'departments'::text),
        ('document'::artifact_type, 'descriptions'::text),
        ('document'::artifact_type, 'documents'::text),
        ('document'::artifact_type, 'flags'::text),
        ('document'::artifact_type, 'names'::text),
        ('document'::artifact_type, 'parameter_fields'::text),
        ('document'::artifact_type, 'parameters'::text),
        ('eval'::artifact_type, 'departments'::text),
        ('eval'::artifact_type, 'descriptions'::text),
        ('eval'::artifact_type, 'evals'::text),
        ('eval'::artifact_type, 'flags'::text),
        ('eval'::artifact_type, 'group_positions'::text),
        ('eval'::artifact_type, 'groups'::text),
        ('eval'::artifact_type, 'names'::text),
        ('eval'::artifact_type, 'run_positions'::text),
        ('eval'::artifact_type, 'runs'::text),
        ('field'::artifact_type, 'conditional_parameters'::text),
        ('field'::artifact_type, 'departments'::text),
        ('field'::artifact_type, 'descriptions'::text),
        ('field'::artifact_type, 'fields'::text),
        ('field'::artifact_type, 'flags'::text),
        ('field'::artifact_type, 'names'::text),
        ('model'::artifact_type, 'departments'::text),
        ('model'::artifact_type, 'descriptions'::text),
        ('model'::artifact_type, 'flags'::text),
        ('model'::artifact_type, 'modalities'::text),
        ('model'::artifact_type, 'models'::text),
        ('model'::artifact_type, 'names'::text),
        ('model'::artifact_type, 'pricing'::text),
        ('model'::artifact_type, 'providers'::text),
        ('model'::artifact_type, 'qualities'::text),
        ('model'::artifact_type, 'reasoning_levels'::text),
        ('model'::artifact_type, 'temperature_levels'::text),
        ('model'::artifact_type, 'values'::text),
        ('model'::artifact_type, 'voices'::text),
        ('parameter'::artifact_type, 'departments'::text),
        ('parameter'::artifact_type, 'descriptions'::text),
        ('parameter'::artifact_type, 'fields'::text),
        ('parameter'::artifact_type, 'flags'::text),
        ('parameter'::artifact_type, 'names'::text),
        ('parameter'::artifact_type, 'parameters'::text),
        ('persona'::artifact_type, 'colors'::text),
        ('persona'::artifact_type, 'departments'::text),
        ('persona'::artifact_type, 'descriptions'::text),
        ('persona'::artifact_type, 'examples'::text),
        ('persona'::artifact_type, 'flags'::text),
        ('persona'::artifact_type, 'icons'::text),
        ('persona'::artifact_type, 'instructions'::text),
        ('persona'::artifact_type, 'names'::text),
        ('persona'::artifact_type, 'parameter_fields'::text),
        ('persona'::artifact_type, 'parameters'::text),
        ('persona'::artifact_type, 'personas'::text),
        ('profile'::artifact_type, 'cohorts'::text),
        ('profile'::artifact_type, 'departments'::text),
        ('profile'::artifact_type, 'emails'::text),
        ('profile'::artifact_type, 'flags'::text),
        ('profile'::artifact_type, 'names'::text),
        ('profile'::artifact_type, 'profiles'::text),
        ('profile'::artifact_type, 'request_limits'::text),
        ('profile'::artifact_type, 'roles'::text),
        ('profile'::artifact_type, 'routes'::text),
        ('provider'::artifact_type, 'departments'::text),
        ('provider'::artifact_type, 'descriptions'::text),
        ('provider'::artifact_type, 'endpoints'::text),
        ('provider'::artifact_type, 'flags'::text),
        ('provider'::artifact_type, 'keys'::text),
        ('provider'::artifact_type, 'names'::text),
        ('provider'::artifact_type, 'providers'::text),
        ('provider'::artifact_type, 'values'::text),
        ('rubric'::artifact_type, 'departments'::text),
        ('rubric'::artifact_type, 'descriptions'::text),
        ('rubric'::artifact_type, 'flags'::text),
        ('rubric'::artifact_type, 'names'::text),
        ('rubric'::artifact_type, 'points'::text),
        ('rubric'::artifact_type, 'rubrics'::text),
        ('rubric'::artifact_type, 'standard_groups'::text),
        ('rubric'::artifact_type, 'standards'::text),
        ('scenario'::artifact_type, 'departments'::text),
        ('scenario'::artifact_type, 'descriptions'::text),
        ('scenario'::artifact_type, 'documents'::text),
        ('scenario'::artifact_type, 'flags'::text),
        ('scenario'::artifact_type, 'images'::text),
        ('scenario'::artifact_type, 'names'::text),
        ('scenario'::artifact_type, 'objectives'::text),
        ('scenario'::artifact_type, 'options'::text),
        ('scenario'::artifact_type, 'parameter_fields'::text),
        ('scenario'::artifact_type, 'parameters'::text),
        ('scenario'::artifact_type, 'personas'::text),
        ('scenario'::artifact_type, 'problem_statements'::text),
        ('scenario'::artifact_type, 'questions'::text),
        ('scenario'::artifact_type, 'scenarios'::text),
        ('scenario'::artifact_type, 'videos'::text),
        ('setting'::artifact_type, 'agents'::text),
        ('setting'::artifact_type, 'auth_item_keys'::text),
        ('setting'::artifact_type, 'auths'::text),
        ('setting'::artifact_type, 'colors'::text),
        ('setting'::artifact_type, 'departments'::text),
        ('setting'::artifact_type, 'descriptions'::text),
        ('setting'::artifact_type, 'flags'::text),
        ('setting'::artifact_type, 'names'::text),
        ('setting'::artifact_type, 'profiles'::text),
        ('setting'::artifact_type, 'provider_keys'::text),
        ('setting'::artifact_type, 'role_routes'::text),
        ('setting'::artifact_type, 'roles'::text),
        ('setting'::artifact_type, 'settings'::text),
        ('setting'::artifact_type, 'thresholds'::text),
        ('simulation'::artifact_type, 'departments'::text),
        ('simulation'::artifact_type, 'descriptions'::text),
        ('simulation'::artifact_type, 'flags'::text),
        ('simulation'::artifact_type, 'names'::text),
        ('simulation'::artifact_type, 'scenario_flags'::text),
        ('simulation'::artifact_type, 'scenario_personas'::text),
        ('simulation'::artifact_type, 'scenario_positions'::text),
        ('simulation'::artifact_type, 'scenario_rubrics'::text),
        ('simulation'::artifact_type, 'scenario_time_limits'::text),
        ('simulation'::artifact_type, 'scenarios'::text),
        ('simulation'::artifact_type, 'simulations'::text),
        ('tool'::artifact_type, 'arg_positions'::text),
        ('tool'::artifact_type, 'args'::text),
        ('tool'::artifact_type, 'args_outputs'::text),
        ('tool'::artifact_type, 'entries'::text),
        ('tool'::artifact_type, 'departments'::text),
        ('tool'::artifact_type, 'descriptions'::text),
        ('tool'::artifact_type, 'resources'::text),
        ('tool'::artifact_type, 'flags'::text),
        ('tool'::artifact_type, 'names'::text),
        ('tool'::artifact_type, 'tools'::text)
    ) AS v(artifact, resource)
    GROUP BY artifact
),

-- ============================================================================
-- PATH 2: Bindings path (JSONB parameter)
-- For artifacts like: attempt, test
-- ============================================================================

-- Get all artifact -> entry mappings from JSONB parameter
-- Only include entries that actually have tool bindings (intersection with bound entries)
artifact_entries AS (
    SELECT
        kv.key::artifact_type as artifact,
        ARRAY_AGG(DISTINCT e.entry::text) FILTER (
            WHERE EXISTS (
                SELECT 1 FROM entries_resource b
                WHERE b.entry = e.entry::entry_type
                AND EXISTS (
                    SELECT 1 FROM tool_entries_junction tbj
                    WHERE tbj.entries_id = b.id AND tbj.active = true
                )
            )
        ) as required_entries
    FROM jsonb_each(p_artifact_entries) AS kv(key, value)
    CROSS JOIN LATERAL jsonb_array_elements_text(kv.value) AS e(entry)
    GROUP BY kv.key
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
        JOIN flags_resource f ON af.flags_id = f.id
        WHERE af.agent_id = a.id
          AND f.name = 'agent_active'
          AND f.value = true
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
              AND ad.departments_id = ANY(user_department_ids)
        )
    )
),

-- ============================================================================
-- AGENT CAPABILITIES
-- ============================================================================

-- Get tool resources for each eligible agent (for resources path)
-- Path: agent_tools_junction -> tool_tools_junction -> tool_resources_junction -> resources_resource
agent_tool_resources AS (
    SELECT
        ea.agent_id,
        ea.updated_at,
        COALESCE(
            ARRAY_AGG(DISTINCT dr.resource::text) FILTER (WHERE dr.resource IS NOT NULL),
            ARRAY[]::text[]
        ) as tool_resources
    FROM eligible_agents ea
    LEFT JOIN agent_tools_junction at ON at.agent_id = ea.agent_id AND at.active = true
    LEFT JOIN tool_tools_junction ttj ON ttj.tool_id = at.tools_id
    LEFT JOIN tool_resources_junction tdj ON tdj.tool_id = ttj.tool_id AND tdj.active = true
    LEFT JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
    GROUP BY ea.agent_id, ea.updated_at
),

-- Get tool entries for each eligible agent (for bindings path)
-- Path: agent_tools_junction -> tools_resource -> tool_tools_junction -> tool_entries_junction -> entries_resource
agent_tool_entries AS (
    SELECT
        ea.agent_id,
        ea.updated_at,
        COALESCE(
            ARRAY_AGG(DISTINCT b.entry::text) FILTER (WHERE b.entry IS NOT NULL ),
            ARRAY[]::text[]
        ) as tool_entries
    FROM eligible_agents ea
    LEFT JOIN agent_tools_junction atj ON atj.agent_id = ea.agent_id AND atj.active = true
    LEFT JOIN tools_resource tr ON tr.id = atj.tools_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
    LEFT JOIN tool_entries_junction tbj ON tbj.tool_id = ttj.tool_id AND tbj.active = true
    LEFT JOIN entries_resource b ON b.id = tbj.entries_id
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
