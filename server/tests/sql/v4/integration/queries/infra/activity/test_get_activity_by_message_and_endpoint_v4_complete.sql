-- Get view_activity_entry by message and endpoint for test assertions
-- Returns view_activity_entry data for assertions
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
    SELECT ae.id, ae.message, ae.endpoint, paj.profiles_id, ae.error, ae.created_at
    FROM audits_entry ae
    LEFT JOIN profiles_audits_connection paj ON paj.audit_id = ae.id
    WHERE ae.message = p_message AND ae.endpoint = p_endpoint
    ORDER BY ae.created_at DESC
    LIMIT 1;
$$;