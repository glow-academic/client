-- Debug info tool call handler
-- This is a no-op function for now - debug info is just logged

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS socket_debug_info_v4(uuid, text);

-- Create function
CREATE OR REPLACE FUNCTION socket_debug_info_v4(
    profile_id uuid,
    info text
) RETURNS TABLE (
    success boolean,
    message text
) LANGUAGE plpgsql AS $$
BEGIN
    -- No-op for now - debug info is logged in Python
    RETURN QUERY SELECT TRUE, 'Debug information logged successfully'::text;
END;
$$;

COMMIT;

