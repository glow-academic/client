-- Get developer messages for a run for test verification
-- Returns count of developer messages
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
    FROM messages m
    JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN message_runs mr ON mr.message_id = m.id
    WHERE m.role = 'developer' AND mr.run_id = test_get_developer_messages_count_by_run_v4.run_id;
$$;