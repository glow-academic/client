-- Get activity by message for test assertions
-- Returns activity data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_activity_by_message_v4(text);

-- Create function
CREATE OR REPLACE FUNCTION test_get_activity_by_message_v4(
    p_message text
)
RETURNS TABLE (
    id uuid,
    message text,
    endpoint text,
    profile_id uuid,
    error boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, message, endpoint, profile_id, error, created_at
    FROM activity
    WHERE message = p_message
    ORDER BY created_at DESC
    LIMIT 1;
$$;