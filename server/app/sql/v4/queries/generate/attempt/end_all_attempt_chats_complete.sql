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
    v_existing_chat_count integer := 0;
    v_expected_scenario_count integer := 0;
    v_chat_record RECORD;
    v_stub_chat_id uuid;
    v_i integer;
BEGIN
    -- Mark all existing incomplete chats as completed
    FOR v_chat_record IN
        SELECT c.id
        FROM chat_resolved_entry c
        JOIN attempt_chat_entry ac ON ac.chat_resolved_id = c.id
        WHERE ac.attempt_id = p_attempt_id AND c.active = TRUE
    LOOP
        INSERT INTO attempt_completion_entry (chat_id)
        VALUES (v_chat_record.id)
        ON CONFLICT (chat_id) DO NOTHING;
        v_chats_completed := v_chats_completed + 1;
    END LOOP;

    -- Count existing chats
    SELECT COUNT(*) INTO v_existing_chat_count
    FROM chat_resolved_entry c
    JOIN attempt_chat_entry ac ON ac.chat_resolved_id = c.id
    WHERE ac.attempt_id = p_attempt_id AND c.active = TRUE;

    -- Count expected scenarios from training bundle
    SELECT COUNT(DISTINCT tsc.scenarios_id) INTO v_expected_scenario_count
    FROM attempt_entry a
    LEFT JOIN attempt_practice_entry apc ON apc.attempt_id = a.id AND apc.active = true
    LEFT JOIN practice_chat_entry pte ON pte.practice_id = apc.practice_id AND pte.active = true
    LEFT JOIN attempt_home_entry ahc ON ahc.attempt_id = a.id AND ahc.active = true
    LEFT JOIN home_chat_entry hte ON hte.home_id = ahc.home_id AND hte.active = true
    JOIN chat_scenarios_connection tsc
      ON tsc.chat_id = COALESCE(pte.chat_id, hte.chat_id)
     AND tsc.active = true
    WHERE a.id = p_attempt_id;

    -- Create stub chats for missing scenarios (count-based, no scenario linkage)
    FOR v_i IN 1..GREATEST(v_expected_scenario_count - v_existing_chat_count, 0)
    LOOP
        INSERT INTO chat_resolved_entry (active)
        VALUES (true)
        RETURNING id INTO v_stub_chat_id;

        -- Bridge: link stub chat to attempt
        INSERT INTO attempt_chat_entry (attempt_id, chat_resolved_id)
        VALUES (p_attempt_id, v_stub_chat_id);

        IF v_stub_chat_id IS NOT NULL THEN
            INSERT INTO attempt_completion_entry (chat_id)
            VALUES (v_stub_chat_id)
            ON CONFLICT (chat_id) DO NOTHING;

            v_stubs_created := v_stubs_created + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_chats_completed, v_stubs_created;
END;
$$;
