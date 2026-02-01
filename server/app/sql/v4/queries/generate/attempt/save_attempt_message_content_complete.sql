-- Save attempt message content - updates assistant message with generated content

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_save_attempt_message_content_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_save_attempt_message_content_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_save_attempt_message_content_v4(
    p_message_id uuid,
    p_content text,
    p_run_id uuid DEFAULT NULL,
    p_input_tokens integer DEFAULT NULL,
    p_output_tokens integer DEFAULT NULL
)
RETURNS TABLE (
    success boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    -- Update message content and mark as completed
    UPDATE simulation_messages_entry
    SET
        content = p_content,
        completed = true,
        updated_at = NOW()
    WHERE id = p_message_id;

    -- Update run token counts if provided
    IF p_run_id IS NOT NULL AND (p_input_tokens IS NOT NULL OR p_output_tokens IS NOT NULL) THEN
        UPDATE runs_entry
        SET
            input_tokens = COALESCE(p_input_tokens, input_tokens),
            output_tokens = COALESCE(p_output_tokens, output_tokens)
        WHERE id = p_run_id;
    END IF;

    RETURN QUERY SELECT TRUE;
END;
$$;
