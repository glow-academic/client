-- End all remaining chats and create stubs for missing scenarios

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_end_all_attempt_chats_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_end_all_attempt_chats_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_end_all_attempt_chats_v4(
    p_attempt_id uuid
)
RETURNS TABLE (
    chats_completed integer,
    stubs_created integer
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_chats_completed integer := 0;
    v_stubs_created integer := 0;
    v_chat_record RECORD;
    v_scenario_record RECORD;
    v_existing_scenario_ids uuid[];
    v_stub_chat_id uuid;
BEGIN
    -- Mark all existing incomplete chats as completed
    FOR v_chat_record IN
        SELECT c.id
        FROM attempt_chat_entry c
        WHERE c.attempt_id = p_attempt_id AND c.active = TRUE
    LOOP
        INSERT INTO attempt_completion_entry (chat_id)
        VALUES (v_chat_record.id)
        ON CONFLICT (chat_id) DO NOTHING;
        v_chats_completed := v_chats_completed + 1;
    END LOOP;

    -- Get existing chat scenario IDs (from base tables, not MV)
    SELECT ARRAY_AGG(DISTINCT csc.scenarios_id) INTO v_existing_scenario_ids
    FROM attempt_chat_entry c
    JOIN attempt_chat_scenarios_connection csc ON csc.chat_id = c.id AND csc.active = true
    WHERE c.attempt_id = p_attempt_id AND c.active = TRUE;

    -- Default to empty array if null
    v_existing_scenario_ids := COALESCE(v_existing_scenario_ids, ARRAY[]::uuid[]);

    -- Find expected scenarios and create stubs for missing ones
    FOR v_scenario_record IN
        SELECT DISTINCT tsc.scenarios_id AS scenario_id
        FROM attempt_entry a
        LEFT JOIN attempt_practice_entry apc ON apc.attempt_id = a.id AND apc.active = true
        LEFT JOIN practice_training_entry pte ON pte.practice_id = apc.practice_id AND pte.active = true
        LEFT JOIN attempt_home_entry ahc ON ahc.attempt_id = a.id AND ahc.active = true
        LEFT JOIN home_training_entry hte ON hte.home_id = ahc.home_id AND hte.active = true
        JOIN training_scenarios_connection tsc
          ON tsc.training_id = COALESCE(pte.training_id, hte.training_id)
         AND tsc.active = true
        WHERE a.id = p_attempt_id
    LOOP
        -- Skip if scenario already has a chat
        IF v_scenario_record.scenario_id = ANY(v_existing_scenario_ids) THEN
            CONTINUE;
        END IF;

        -- Create stub chat
        INSERT INTO attempt_chat_entry (attempt_id, active)
        VALUES (p_attempt_id, true)
        RETURNING id INTO v_stub_chat_id;

        IF v_stub_chat_id IS NULL THEN
            CONTINUE;
        END IF;

        -- Link scenario to stub chat
        INSERT INTO attempt_chat_scenarios_connection
            (chat_id, scenarios_id, active)
        VALUES (v_stub_chat_id, v_scenario_record.scenario_id, true)
        ON CONFLICT DO NOTHING;

        -- Mark as completed
        INSERT INTO attempt_completion_entry (chat_id)
        VALUES (v_stub_chat_id)
        ON CONFLICT (chat_id) DO NOTHING;

        v_stubs_created := v_stubs_created + 1;
    END LOOP;

    RETURN QUERY SELECT v_chats_completed, v_stubs_created;
END;
$$;
