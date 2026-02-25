-- End a single attempt chat: verify and mark as completed

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_end_attempt_chat_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_end_attempt_chat_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_end_attempt_chat_v4(
    p_attempt_id uuid,
    p_chat_id uuid
)
RETURNS TABLE (
    success boolean,
    chat_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_chat_id uuid;
BEGIN
    -- Verify chat exists and belongs to this attempt
    SELECT c.id INTO v_chat_id
    FROM attempt_chat_entry c
    JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
    WHERE c.id = p_chat_id AND ac.attempt_id = p_attempt_id AND c.active = TRUE;

    IF v_chat_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::uuid;
        RETURN;
    END IF;

    -- Mark chat as completed
    INSERT INTO attempt_completion_entry (chat_id)
    VALUES (v_chat_id)
    ON CONFLICT (chat_id) DO NOTHING;

    RETURN QUERY SELECT TRUE, v_chat_id;
END;
$$;
