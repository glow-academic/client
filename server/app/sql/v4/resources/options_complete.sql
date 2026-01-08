-- Create options resource
-- Always INSERT operation (preserves all information)
-- Parameters: option_text text, is_correct boolean
-- Returns: option_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_options_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_options_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_options_v4(
    option_text text, is_correct boolean
)
RETURNS TABLE (
    option_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_option_id uuid;
BEGIN
    -- INSERT into options table (always insert, never update)
    INSERT INTO options(option_text, is_correct, active)
    VALUES (option_text, is_correct, true)
    RETURNING id INTO v_option_id;

    RETURN QUERY SELECT v_option_id;
END;
$$;