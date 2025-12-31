-- Get activity by message and endpoint for test assertions
-- Returns activity data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_activity_by_message_and_endpoint_v4(text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_get_activity_by_message_and_endpoint_v4(
    p_message text,
    p_endpoint text
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
    WHERE message = p_message AND endpoint = p_endpoint
    ORDER BY created_at DESC
    LIMIT 1;
$$;

COMMIT;

