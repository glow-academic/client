-- Standard description tool progress handler
-- No-op function for now

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS socket_standard_description_progress_v3(uuid, text, text);

-- Create function
CREATE FUNCTION socket_standard_description_progress_v3(
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

