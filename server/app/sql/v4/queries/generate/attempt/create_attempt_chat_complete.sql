-- Create attempt chat - creates chat entry + config snapshots.
-- Extracted from prepare_training_start to decouple chat creation
-- from scenario scope setup.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_create_attempt_chat_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_attempt_chat_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION socket_create_attempt_chat_v4(
    p_profile_id uuid,
    p_attempt_id uuid,
    p_training_bundle_department_id uuid
)
RETURNS TABLE (chat_id uuid)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_chat_id uuid;
    v_session_id uuid;
    v_group_id uuid;
    v_trace_id text;
    v_config_id uuid;
    v_entry RECORD;
BEGIN
    -- Create chat entry.
    INSERT INTO simulation_chats_entry (attempt_id, created_at, updated_at, title, training_bundle_department_id)
    VALUES (p_attempt_id, NOW(), NOW(), 'Chat', p_training_bundle_department_id)
    RETURNING id INTO v_chat_id;

    -- Create per-entry config snapshots by resolving agents server-side.
    SELECT id INTO v_session_id
    FROM sessions_entry
    WHERE profile_id = p_profile_id
      AND active = true
    ORDER BY created_at DESC
    LIMIT 1;

    FOR v_entry IN
        SELECT *
        FROM socket_resolve_attempt_entries_v4(
            p_profile_id,
            ARRAY['contents', 'hints', 'grades', 'feedbacks']::text[]
        )
    LOOP
        IF v_entry.agent_id IS NULL THEN
            CONTINUE;
        END IF;

        INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (NOW(), NOW(), v_session_id)
        RETURNING id, trace_id INTO v_group_id, v_trace_id;

        UPDATE simulation_chats_entry
        SET group_id = v_group_id
        WHERE id = v_chat_id;

        INSERT INTO config_entry (created_at, updated_at, generated, mcp, active)
        VALUES (NOW(), NOW(), false, false, true)
        RETURNING id INTO v_config_id;

        INSERT INTO config_agents_connection (config_id, agents_id, created_at, active, generated, mcp)
        SELECT v_config_id, aaj.agents_id, NOW(), true, false, false
        FROM agent_agents_junction aaj
        WHERE aaj.agent_id = v_entry.agent_id
          AND aaj.active = true
        ON CONFLICT (config_id, agents_id) DO NOTHING;

        INSERT INTO config_models_connection (config_id, models_id, created_at, active, generated, mcp)
        SELECT v_config_id, ar.model_id, NOW(), true, false, false
        FROM agent_agents_junction aaj
        JOIN agents_resource ar ON ar.id = aaj.agents_id
        WHERE aaj.agent_id = v_entry.agent_id
          AND aaj.active = true
          AND ar.model_id IS NOT NULL
        ON CONFLICT (config_id, models_id) DO NOTHING;

        INSERT INTO config_providers_connection (config_id, providers_id, created_at, active, generated, mcp)
        SELECT v_config_id, mr.provider_id, NOW(), true, false, false
        FROM agent_agents_junction aaj
        JOIN agents_resource ar ON ar.id = aaj.agents_id
        JOIN models_resource mr ON mr.id = ar.model_id
        WHERE aaj.agent_id = v_entry.agent_id
          AND aaj.active = true
          AND mr.provider_id IS NOT NULL
        ON CONFLICT (config_id, providers_id) DO NOTHING;
    END LOOP;

    RETURN QUERY SELECT v_chat_id;
END;
$$;
