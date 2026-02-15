-- Create a user message from voice transcription.
-- Lighter than prepare_attempt_message — no assistant placeholder, no run/config.
-- Voice assistant messages are created separately by the realtime adapter flow.

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_voice_user_message_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_voice_user_message_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_prepare_voice_user_message_v4(
    p_profile_id uuid,
    p_chat_id uuid,
    p_message text
)
RETURNS TABLE (
    user_message_id uuid,
    created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_user_message_id uuid;
    v_group_id uuid;
    v_run_id uuid;
    v_created_at timestamptz;
BEGIN
    -- Get group_id from the chat
    SELECT sc.group_id INTO v_group_id
    FROM simulation_chats_entry sc
    WHERE sc.id = p_chat_id;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'No group_id found for chat_id %', p_chat_id;
    END IF;

    -- Create a run for tracking
    INSERT INTO runs_entry (input_tokens, output_tokens, group_id)
    VALUES (0, 0, v_group_id)
    RETURNING id INTO v_run_id;

    -- Link run to profile
    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    VALUES (p_profile_id, v_run_id);

    v_created_at := NOW();

    -- Create user message
    INSERT INTO messages_entry (run_id, role, completed, audio, created_at, updated_at)
    VALUES (v_run_id, 'user'::message_type, true, true, v_created_at, v_created_at)
    RETURNING messages_entry.id INTO v_user_message_id;

    -- Link to simulation chat
    INSERT INTO simulation_messages_entry (id, chat_id)
    VALUES (v_user_message_id, p_chat_id);

    -- Insert content (with Student persona)
    INSERT INTO simulation_contents_entry (message_id, content, persona_id)
    VALUES (v_user_message_id, p_message, '019bb25e-e60c-7352-9b81-f411f56092a9'::uuid);

    RETURN QUERY SELECT v_user_message_id, v_created_at;
END;
$$;
