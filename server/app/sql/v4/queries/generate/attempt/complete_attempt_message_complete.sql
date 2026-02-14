-- Complete an attempt message: mark completed, update tokens, return persona_id

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_complete_attempt_message_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_complete_attempt_message_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_complete_attempt_message_v4(
    p_message_id uuid,
    p_run_id uuid,
    p_input_tokens integer DEFAULT NULL,
    p_output_tokens integer DEFAULT NULL
)
RETURNS TABLE (
    persona_id text
)
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    -- Mark message as completed
    UPDATE messages_entry
    SET completed = true, updated_at = NOW()
    WHERE id = p_message_id;

    -- Update token usage on the run
    UPDATE runs_entry
    SET input_tokens = COALESCE(p_input_tokens, input_tokens),
        output_tokens = COALESCE(p_output_tokens, output_tokens),
        updated_at = NOW()
    WHERE id = p_run_id;

    -- Return persona_id from the content entry (inserted by create_content tool)
    RETURN QUERY
    SELECT ce.persona_id::text
    FROM simulation_contents_entry ce
    WHERE ce.message_id = p_message_id AND ce.active = true AND ce.persona_id IS NOT NULL
    ORDER BY ce.created_at DESC
    LIMIT 1;
END;
$$;
