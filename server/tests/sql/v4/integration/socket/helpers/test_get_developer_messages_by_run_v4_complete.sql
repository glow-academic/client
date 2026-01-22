-- Get developer messages_entry for a run for test verification
-- Returns count of developer messages_entry
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
    FROM messages_entry m
    JOIN contents_entry ce ON ce.message_id = m.id AND ce.idx = 0
    WHERE m.role = 'developer' AND m.run_id = test_get_developer_messages_count_by_run_v4.run_id;
$$;