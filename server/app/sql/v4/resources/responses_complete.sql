-- Create responses resource
-- Always INSERT operation (preserves all information)
-- Parameters: option_id (uuid), question_id (uuid)
-- Returns: response_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_responses_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_responses_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_responses_v4(
    option_id uuid, question_id uuid
)
RETURNS TABLE (
    response_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_response_id uuid;
BEGIN
    -- INSERT into responses table (always insert, never update)
    INSERT INTO responses(option_id, question_id, active)
    VALUES (option_id, question_id, true)
    RETURNING id INTO v_response_id;
    
    RETURN QUERY SELECT v_response_id;
END;
$$;
