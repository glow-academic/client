-- Get group_stop tools for a group (converted to PostgreSQL function)
--
-- DERIVATION LOGIC (preserved for reference):
-- ============================================================
-- The group_stop table was a denormalized cache that stored which stop tools
-- (like end_conversation) were called at each position within a conversation group.
-- This data is fully derivable from group_runs + message_runs + calls_entry:
--
-- Original table structure:
--   group_stop(group_id, tool_id, position_idx, created_at, updated_at, generated, mcp, active)
--
-- Derivation formula:
--   For each run in a group (via group_runs), we find calls_entry made during that run
--   (via message_runs -> calls_entry) where the tool is a "stop" tool (like end_conversation).
--   The position_idx is computed as ROW_NUMBER() ordered by run position and call time.
--
-- The query below computes the same result without needing the
-- group_stop table, using:
--   - group_runs: links runs_entry to groups_entry with idx (position)
--   - message_runs: links messages_entry to runs_entry
--   - calls_entry: contains tool calls_entry with tool_id
--   - tool_names_junction/names_resource: to identify stop tools by name
--
-- This allows us to drop the group_stop table while preserving functionality.
-- ============================================================

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_group_stop_tools_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_group_stop_tools_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_group_stop_tools_v4(
    group_id uuid
)
RETURNS TABLE (
    tool_id uuid,
    position_idx integer
)
LANGUAGE sql
STABLE
AS $$
    WITH stop_tool_ids AS (
        -- Find all "stop" tools (currently just end_conversation, but extensible)
        SELECT t.id as tool_id
        FROM tool_artifact t
        JOIN tool_names_junction tn ON tn.tool_id = t.id
        JOIN names_resource n ON n.id = tn.name_id
        WHERE n.name = 'end_conversation'
          AND EXISTS (
              SELECT 1 FROM tool_flags_junction tf
              JOIN flags_resource f ON tf.flag_id = f.id
              WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true
          )
    ),
    ordered_tool_calls AS (
        SELECT
            r.group_id,
            tcj.tool_id,
            ROW_NUMBER() OVER (PARTITION BY r.group_id ORDER BY r.created_at, c.created_at) as position_idx
        FROM runs_entry r
        JOIN calls_entry c ON c.run_id = r.id
        JOIN tool_calls_junction tcj ON tcj.call_id = c.id
        JOIN stop_tool_ids sti ON sti.tool_id = tcj.tool_id
        WHERE r.group_id = $1
    )
    SELECT
        tool_id::uuid,
        position_idx::integer
    FROM ordered_tool_calls
    ORDER BY position_idx ASC
$$;
