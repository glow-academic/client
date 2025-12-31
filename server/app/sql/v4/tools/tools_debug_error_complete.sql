-- Debug info tool error handler
-- No-op function for now

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS socket_debug_info_error_v4(uuid, boolean, text);

-- Create function
CREATE FUNCTION socket_debug_info_error_v4(
    profile_id uuid,
    success_val boolean,
    message_val text
) RETURNS TABLE (
    success boolean,
    message text
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY SELECT success_val, message_val;
END;
$$;

COMMIT;

