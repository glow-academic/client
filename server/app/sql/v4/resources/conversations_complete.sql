-- Create conversations resource
-- Always INSERT operation (preserves all information)
-- Parameters: end_reason text
-- Returns: conversation_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_conversations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_conversations_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_conversations_v4(
    end_reason text
)
RETURNS TABLE (
    conversation_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_conversation_id uuid;
BEGIN
    -- INSERT into conversations table (always insert, never update)
    INSERT INTO conversations(end_reason, active)
    VALUES (end_reason, true)
    RETURNING id INTO v_conversation_id;

    RETURN QUERY SELECT v_conversation_id;
END;
$$;