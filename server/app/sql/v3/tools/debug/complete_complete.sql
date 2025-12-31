-- Debug info tool complete handler
-- No-op function for now

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS socket_debug_info_complete_v3(uuid, boolean, text);

-- Create function
CREATE FUNCTION socket_debug_info_complete_v3(
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

