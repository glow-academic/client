-- Prepare attempt message: mutations only (run/config/messages creation)
-- All data fetching is now done in Python from pre-fetched resources
-- group_id and resolved resource IDs are passed directly

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_attempt_message_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_attempt_message_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function (mutations only)
CREATE OR REPLACE FUNCTION socket_prepare_attempt_message_v4(
    p_profile_id uuid,
    p_chat_id uuid,
    p_message text,
    p_voice_mode boolean DEFAULT false,
    p_upload_id uuid DEFAULT NULL,
    p_group_id uuid DEFAULT NULL,
    p_agents_resource_id uuid DEFAULT NULL,
    p_models_resource_id uuid DEFAULT NULL,
    p_providers_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    user_message_id uuid,
    assistant_message_id uuid,
    run_id uuid,
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

    -- Get group_id directly from simulation_chats_entry
    -- If p_group_id is provided (regeneration), use that directly
    IF p_group_id IS NOT NULL THEN
        v_group_id := p_group_id;
    ELSE
        SELECT sc.group_id INTO v_group_id
        FROM simulation_chats_entry sc
        WHERE sc.id = p_chat_id;
    END IF;

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

    -- Create user message in base table first
    INSERT INTO messages_entry (run_id, role, audio, created_at, updated_at)
    VALUES (v_run_id, 'user'::message_type, p_voice_mode, v_created_at, v_created_at)
    RETURNING messages_entry.id INTO v_user_message_id;

    -- Mark user message as completed (append-only)
    INSERT INTO messages_completions_entry (message_id)
    VALUES (v_user_message_id);

    -- Link user message to simulation chat
    INSERT INTO simulation_messages_entry (id, chat_id)
    VALUES (v_user_message_id, p_chat_id);

    -- Insert user content (with Student persona)
    INSERT INTO simulation_contents_entry (message_id, content, persona_id)
    VALUES (v_user_message_id, p_message, '019bb25e-e60c-7352-9b81-f411f56092a9'::uuid);

    -- Create assistant message placeholder in base table
    -- Offset by 1ms so ORDER BY created_at is deterministic (user before assistant)
    INSERT INTO messages_entry (run_id, role, audio, created_at, updated_at)
    VALUES (v_run_id, 'assistant'::message_type, p_voice_mode, v_created_at + interval '1 millisecond', v_created_at + interval '1 millisecond')
    RETURNING messages_entry.id INTO v_assistant_message_id;

    -- Link assistant message to simulation chat
    INSERT INTO simulation_messages_entry (id, chat_id)
    VALUES (v_assistant_message_id, p_chat_id);

    RETURN QUERY SELECT v_user_message_id, v_assistant_message_id, v_run_id, v_created_at;
END;
$$;
