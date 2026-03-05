-- Resolve agent ID from list by entry types
-- Given a list of agent IDs and required entry types, finds the agent(s) whose tools
-- produce ANY of those entry types.
-- Parameters: p_agent_ids (uuid[]), p_entry_types (text[])
-- Returns: resolved_agent_id, matching_count, error_code

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_resolve_agent_by_entry_types_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_resolve_agent_by_entry_types_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION socket_resolve_agent_by_entry_types_v4(
    p_agent_ids uuid[],
    p_entry_types text[]
)
RETURNS TABLE (
    resolved_agent_id uuid,
    matching_count int,
    error_code text
)
LANGUAGE sql
STABLE
AS $$
WITH
-- ============================================================================
-- Get tool entries for each provided agent
-- Path: agent_tools_junction -> tools_resource -> tool_tools_junction
--       -> tool_entries_junction -> entries_resource
-- ============================================================================
agent_tool_entries AS (
    SELECT
        a.id as agent_id,
        COALESCE(
            ARRAY_AGG(DISTINCT b.entry::text) FILTER (WHERE b.entry IS NOT NULL ),
            ARRAY[]::text[]
        ) as tool_entries
    FROM UNNEST(p_agent_ids) as aid(id)
    JOIN agent_artifact a ON a.id = aid.id
    LEFT JOIN agent_tools_junction atj ON atj.agent_id = a.id AND atj.active = true
    LEFT JOIN tools_resource tr ON tr.id = atj.tool_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
    LEFT JOIN tool_entries_junction tbj ON tbj.tool_id = ttj.tool_id AND tbj.active = true
    LEFT JOIN entries_resource b ON b.id = tbj.entries_id
    GROUP BY a.id
),

-- ============================================================================
-- Score agents by how many required entry types they produce
-- ============================================================================
scored_agents AS (
    SELECT
        ate.agent_id,
        COALESCE(
            CARDINALITY(
                ARRAY(SELECT unnest(p_entry_types) INTERSECT SELECT unnest(ate.tool_entries))
            ),
            0
        ) as matching_count
    FROM agent_tool_entries ate
),

-- ============================================================================
-- Filter to agents that match at least one entry type
-- ============================================================================
matching_agents AS (
    SELECT agent_id, matching_count
    FROM scored_agents
    WHERE matching_count > 0
),

-- ============================================================================
-- Determine result
-- ============================================================================
agent_count AS (
    SELECT COUNT(*) as cnt FROM matching_agents
),

result AS (
    SELECT
        CASE
            WHEN ac.cnt = 0 THEN NULL
            WHEN ac.cnt = 1 THEN (SELECT agent_id FROM matching_agents LIMIT 1)
            ELSE NULL
        END as resolved_agent_id,
        CASE
            WHEN ac.cnt = 0 THEN 0
            WHEN ac.cnt = 1 THEN (SELECT matching_count FROM matching_agents LIMIT 1)
            ELSE (SELECT MAX(matching_count) FROM matching_agents)
        END as matching_count,
        CASE
            WHEN ac.cnt = 0 THEN 'none_found'
            WHEN ac.cnt > 1 THEN 'multiple_found'
            ELSE NULL
        END as error_code
    FROM agent_count ac
)

SELECT
    r.resolved_agent_id,
    r.matching_count::int,
    r.error_code
FROM result r;
$$;
