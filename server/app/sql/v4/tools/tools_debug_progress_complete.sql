-- Debug info tool progress handler
-- No-op function for now

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS socket_debug_info_progress_v4(uuid, text, text);

-- Create function
CREATE FUNCTION socket_debug_info_progress_v4(
    profile_id uuid,
    type_val text,
    message_val text
) RETURNS TABLE (
    type text,
    message text
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY SELECT type_val, message_val;
END;
$$;

COMMIT;

