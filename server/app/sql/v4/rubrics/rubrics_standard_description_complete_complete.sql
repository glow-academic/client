-- Standard description tool complete handler
-- No-op function for now

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS socket_standard_description_complete_v4(uuid, boolean, uuid, text);

-- Create function
CREATE FUNCTION socket_standard_description_complete_v4(
    profile_id uuid,
    success_val boolean,
    standard_description_id_val uuid,
    message_val text
) RETURNS TABLE (
    success boolean,
    standard_description_id uuid,
    message text
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY SELECT success_val, standard_description_id_val, message_val;
END;
$$;

COMMIT;

