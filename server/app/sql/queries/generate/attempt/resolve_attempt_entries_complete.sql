-- Resolve agent for each attempt entry type based on profile's departments.
-- Used at training start time to pre-resolve agents for all entry types.
-- Parameters: p_profile_id (uuid), p_entry_types (text[])
-- Returns: one row per entry_type with the resolved agent_id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_resolve_attempt_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_resolve_attempt_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION socket_resolve_attempt_entries_v4(
    p_profile_id uuid,
    p_entry_types text[]
)
RETURNS TABLE (
    entry_type text,
    agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH
-- Get user's department IDs
user_departments AS (
    SELECT pd.department_id
    FROM profile_departments_junction pd
    WHERE pd.profile_id = p_profile_id AND pd.active = true
),
-- Find active agents accessible to this user (cross-department or matching department)
accessible_agents AS (
    SELECT DISTINCT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (
        SELECT 1 FROM agent_flags_junction af
        JOIN flags_resource f ON af.flag_id = f.id
        WHERE af.agent_id = a.id AND f.name = 'agent_active' AND f.value = true
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
            JOIN user_departments ud ON ud.department_id = ad.department_id
            WHERE ad.agent_id = a.id AND ad.active = true
        )
    )
),
-- Map each agent to the entry types its tools can create
agent_entry_types AS (
    SELECT
        aa.agent_id,
        b.entry::text as entry_type
    FROM accessible_agents aa
    JOIN agent_tools_junction atj ON atj.agent_id = aa.agent_id AND atj.active = true
    JOIN tools_resource tr ON tr.id = atj.tool_id
    JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
    JOIN tool_entries_junction tbj ON tbj.tool_id = ttj.tool_id AND tbj.active = true
    JOIN entries_resource b ON b.id = tbj.entries_id AND b.active = true 
    WHERE b.entry::text = ANY(p_entry_types)
),
-- Count how many entry types each agent covers (breadth score)
agent_coverage AS (
    SELECT
        aet.agent_id,
        COUNT(DISTINCT aet.entry_type) as total_entry_coverage
    FROM agent_entry_types aet
    GROUP BY aet.agent_id
),
-- For each requested entry type, pick the best agent
-- Prefer the agent that covers the most entry types (breadth)
ranked_agents AS (
    SELECT
        aet.entry_type,
        aet.agent_id,
        ac.total_entry_coverage,
        ROW_NUMBER() OVER (
            PARTITION BY aet.entry_type
            ORDER BY ac.total_entry_coverage DESC, aet.agent_id
        ) as rn
    FROM agent_entry_types aet
    JOIN agent_coverage ac ON ac.agent_id = aet.agent_id
)
SELECT
    ra.entry_type,
    ra.agent_id
FROM ranked_agents ra
WHERE ra.rn = 1;
$$;
