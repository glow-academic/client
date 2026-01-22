-- Get group_order agents for a group (INLINED - no longer uses group_order table)
--
-- DERIVATION LOGIC (preserved for reference - DO NOT DELETE):
-- ============================================================
-- The group_order table was a denormalized cache that stored which agents
-- were used at each position within a conversation group. This data is
-- fully derivable from group_runs + runs:
--
-- Original table structure:
--   group_order(group_id, agent_id, position_idx, created_at, updated_at, generated, mcp, active)
--
-- Derivation formula:
--   For each run in a group (via group_runs), we get the agent_id from runs
--   and use group_runs.idx as the position_idx.
--
-- The inline query below computes the same result without needing the
-- group_order table, using:
--   - group_runs: links runs to groups with idx (position)
--   - runs: contains agent_id for each run
--
-- This allows us to drop the group_order table while preserving functionality.
-- ============================================================

SELECT DISTINCT
    r.agent_id::uuid,
    gr.idx as position_idx
FROM group_runs gr
JOIN runs r ON r.id = gr.run_id
WHERE gr.group_id = $1
  AND r.agent_id IS NOT NULL
  AND gr.active = true
ORDER BY gr.idx ASC
