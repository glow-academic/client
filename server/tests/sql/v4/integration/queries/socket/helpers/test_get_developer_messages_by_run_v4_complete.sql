-- Get developer view_messages_entry for a run for test verification
-- Returns count of developer view_messages_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_developer_messages_count_by_run_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_developer_messages_count_by_run_v4(
    run_id uuid
)
RETURNS TABLE (
    message_count bigint
)
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::bigint as message_count
    FROM view_messages_entry m
    JOIN LATERAL (
        SELECT content
        FROM simulation_contents_entry ce
        WHERE ce.message_id = m.id
          AND ce.active = true
        ORDER BY ce.created_at
        LIMIT 1
    ) ce ON TRUE
    WHERE m.role = 'developer' AND m.run_id = test_get_developer_messages_count_by_run_v4.run_id;
$$;
