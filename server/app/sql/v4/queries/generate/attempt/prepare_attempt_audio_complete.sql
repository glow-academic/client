-- Prepare attempt audio: create empty user + assistant placeholders + run/config
-- Called by audio/start.py before delegating to attempt_generate.
-- Similar to prepare_attempt_message but without message content (audio fills it later).

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_attempt_audio_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_attempt_audio_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_prepare_attempt_audio_v4(
    p_profile_id uuid,
    p_chat_id uuid,
    p_agents_resource_id uuid DEFAULT NULL,
    p_models_resource_id uuid DEFAULT NULL,
    p_providers_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    user_message_id uuid,
    assistant_message_id uuid,
    run_id uuid,
    group_id uuid,
    created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_user_message_id uuid;
    v_assistant_message_id uuid;
    v_run_id uuid;
    v_group_id uuid;
    v_config_id uuid;
    v_created_at timestamptz;
BEGIN
    -- Get group_id from the chat
    SELECT sc.group_id INTO v_group_id
    FROM chat_resolved_entry sc
    WHERE sc.id = p_chat_id;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'No group_id found for chat_id %. Group should be set at training start time.', p_chat_id;
    END IF;

    -- Create run
    INSERT INTO runs_entry (group_id)
    VALUES (v_group_id)
    RETURNING id INTO v_run_id;

    -- Create config snapshot with run_id
    INSERT INTO config_entry (created_at, updated_at, generated, mcp, active, run_id)
    VALUES (NOW(), NOW(), false, false, true, v_run_id)
    RETURNING id INTO v_config_id;

    -- Config connections (agents, models, providers)
    IF p_agents_resource_id IS NOT NULL THEN
        INSERT INTO config_agents_connection (config_id, agents_id, created_at, active, generated, mcp)
        VALUES (v_config_id, p_agents_resource_id, NOW(), true, false, false)
        ON CONFLICT (config_id, agents_id) DO NOTHING;
    END IF;

    IF p_models_resource_id IS NOT NULL THEN
        INSERT INTO config_models_connection (config_id, models_id, created_at, active, generated, mcp)
        VALUES (v_config_id, p_models_resource_id, NOW(), true, false, false)
        ON CONFLICT (config_id, models_id) DO NOTHING;
    END IF;

    IF p_providers_resource_id IS NOT NULL THEN
        INSERT INTO config_providers_connection (config_id, providers_id, created_at, active, generated, mcp)
        VALUES (v_config_id, p_providers_resource_id, NOW(), true, false, false)
        ON CONFLICT (config_id, providers_id) DO NOTHING;
    END IF;

    -- Link run to profile
    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    VALUES (p_profile_id, v_run_id);

    v_created_at := NOW();

    -- Create empty user message placeholder (audio content filled later)
    INSERT INTO messages_entry (run_id, role, audio, created_at, updated_at)
    VALUES (v_run_id, 'user'::message_type, true, v_created_at, v_created_at)
    RETURNING messages_entry.id INTO v_user_message_id;

    -- Link user message to simulation chat
    INSERT INTO attempt_message_entry (id, chat_id)
    VALUES (v_user_message_id, p_chat_id);

    -- Create assistant message placeholder
    INSERT INTO messages_entry (run_id, role, audio, created_at, updated_at)
    VALUES (v_run_id, 'assistant'::message_type, true, v_created_at + interval '1 millisecond', v_created_at + interval '1 millisecond')
    RETURNING messages_entry.id INTO v_assistant_message_id;

    -- Link assistant message to simulation chat
    INSERT INTO attempt_message_entry (id, chat_id)
    VALUES (v_assistant_message_id, p_chat_id);

    RETURN QUERY SELECT v_user_message_id, v_assistant_message_id, v_run_id, v_group_id, v_created_at;
END;
$$;
