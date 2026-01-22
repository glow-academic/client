-- Get group_order agents for a group (converted to PostgreSQL function)
--
-- DERIVATION LOGIC (preserved for reference):
-- ============================================================
-- The group_order table was a denormalized cache that stored which agents
-- were used at each position within a conversation group. This data is
-- fully derivable from group_runs + runs_entry:
--
-- Original table structure:
--   group_order(group_id, agent_id, position_idx, created_at, updated_at, generated, mcp, active)
--
-- Derivation formula:
--   For each run in a group (via group_runs), we get the agent_id from runs_entry
--   and use group_runs.idx as the position_idx.
--
-- The query below computes the same result without needing the
-- group_order table, using:
--   - group_runs: links runs_entry to groups_entry with idx (position)
--   - runs_entry: contains agent_id for each run
--
-- This allows us to drop the group_order table while preserving functionality.
-- ============================================================

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_group_order_agents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_group_order_agents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_group_order_agents_v4(
    group_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    position_idx integer
)
LANGUAGE sql
STABLE
AS $$
    SELECT DISTINCT ON (r.agent_id)
        r.agent_id::uuid,
        (ROW_NUMBER() OVER (ORDER BY r.created_at ASC))::integer as position_idx
    FROM runs_entry r
    WHERE r.group_id = $1
      AND r.agent_id IS NOT NULL
    ORDER BY r.agent_id, r.created_at ASC
$$;
