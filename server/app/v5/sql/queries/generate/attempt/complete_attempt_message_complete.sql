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
    -- Mark message as completed (append-only)
    INSERT INTO messages_completions_entry (message_id)
    VALUES (p_message_id);

    -- Insert token usage (append-only)
    IF p_input_tokens IS NOT NULL OR p_output_tokens IS NOT NULL THEN
        INSERT INTO tokens_entry (run_id, input_tokens, output_tokens)
        VALUES (p_run_id, COALESCE(p_input_tokens, 0), COALESCE(p_output_tokens, 0));
    END IF;

    -- Return persona_id from the content entry (inserted by create_content tool)
    RETURN QUERY
    SELECT ce.persona_id::text
    FROM attempt_content_entry ce
    WHERE ce.message_id = p_message_id AND ce.active = true AND ce.persona_id IS NOT NULL
    ORDER BY ce.created_at DESC
    LIMIT 1;
END;
$$;
