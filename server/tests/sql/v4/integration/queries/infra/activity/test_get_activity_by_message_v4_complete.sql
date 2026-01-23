-- Get activity_entry by message for test assertions
-- Returns activity_entry data for assertions
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
    SELECT ae.id, ae.message, ae.endpoint, paj.profile_id, ae.error, ae.created_at
    FROM audits_entry ae
    LEFT JOIN profile_audits_junction paj ON paj.audit_id = ae.id
    WHERE ae.message = p_message
    ORDER BY ae.created_at DESC
    LIMIT 1;
$$;