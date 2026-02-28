-- Create attempt_chat entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_attempt_chat_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_attempt_chat_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_attempt_chat_entry_v4(
    run_id uuid,
    title text DEFAULT '',
    group_id uuid DEFAULT NULL,
    chat_id uuid DEFAULT NULL,
    "position" integer DEFAULT 0,
    time_limit integer DEFAULT NULL,
    negative_time boolean DEFAULT false,
    audio_enabled boolean DEFAULT true,
    text_enabled boolean DEFAULT true,
    hints_enabled boolean DEFAULT false,
    copy_paste_allowed boolean DEFAULT true,
    show_images boolean DEFAULT true,
    show_objectives boolean DEFAULT true,
    show_problem_statement boolean DEFAULT true,
    analyses_enabled boolean DEFAULT true,
    improvements_enabled boolean DEFAULT true,
    replacements_enabled boolean DEFAULT true,
    strengths_enabled boolean DEFAULT true,
    use_custom boolean DEFAULT false,
    use_previous boolean DEFAULT false,
    problem_statement_enabled boolean DEFAULT true,
    objectives_enabled boolean DEFAULT true,
    video_enabled boolean DEFAULT false,
    images_enabled boolean DEFAULT false,
    questions_enabled boolean DEFAULT false,
    assistant_persona_ids uuid[] DEFAULT NULL,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid, call_id uuid, message_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
    v_entry_id uuid;
    v_call_id uuid;
    v_text_id uuid;
    v_message_id uuid;
BEGIN
    -- 1. Create text record
    INSERT INTO texts_entry (content, generated, mcp)
    VALUES ('Created attempt chat: ' || api_create_attempt_chat_entry_v4.title, true, api_create_attempt_chat_entry_v4.mcp)
    ON CONFLICT (content_hash) DO UPDATE SET id = texts_entry.id
    RETURNING texts_entry.id INTO v_text_id;

    -- 2. Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (id, run_id, external_call_id)
    VALUES (v_call_id, api_create_attempt_chat_entry_v4.run_id, 'attempt_chat_' || v_call_id::text);

    -- 3. Create entry
    INSERT INTO attempt_chat_entry (
        call_id, title, group_id, chat_id, "position", time_limit, negative_time,
        audio_enabled, text_enabled, hints_enabled, copy_paste_allowed,
        show_images, show_objectives, show_problem_statement,
        analyses_enabled, improvements_enabled, replacements_enabled, strengths_enabled,
        use_custom, use_previous, problem_statement_enabled, objectives_enabled,
        video_enabled, images_enabled, questions_enabled, assistant_persona_ids, mcp
    )
    VALUES (
        v_call_id,
        api_create_attempt_chat_entry_v4.title,
        api_create_attempt_chat_entry_v4.group_id,
        api_create_attempt_chat_entry_v4.chat_id,
        api_create_attempt_chat_entry_v4."position",
        api_create_attempt_chat_entry_v4.time_limit,
        api_create_attempt_chat_entry_v4.negative_time,
        api_create_attempt_chat_entry_v4.audio_enabled,
        api_create_attempt_chat_entry_v4.text_enabled,
        api_create_attempt_chat_entry_v4.hints_enabled,
        api_create_attempt_chat_entry_v4.copy_paste_allowed,
        api_create_attempt_chat_entry_v4.show_images,
        api_create_attempt_chat_entry_v4.show_objectives,
        api_create_attempt_chat_entry_v4.show_problem_statement,
        api_create_attempt_chat_entry_v4.analyses_enabled,
        api_create_attempt_chat_entry_v4.improvements_enabled,
        api_create_attempt_chat_entry_v4.replacements_enabled,
        api_create_attempt_chat_entry_v4.strengths_enabled,
        api_create_attempt_chat_entry_v4.use_custom,
        api_create_attempt_chat_entry_v4.use_previous,
        api_create_attempt_chat_entry_v4.problem_statement_enabled,
        api_create_attempt_chat_entry_v4.objectives_enabled,
        api_create_attempt_chat_entry_v4.video_enabled,
        api_create_attempt_chat_entry_v4.images_enabled,
        api_create_attempt_chat_entry_v4.questions_enabled,
        api_create_attempt_chat_entry_v4.assistant_persona_ids,
        api_create_attempt_chat_entry_v4.mcp
    )
    RETURNING attempt_chat_entry.id INTO v_entry_id;

    -- 4. Create message
    INSERT INTO messages_entry (run_id, call_id, role, text_id, generated, mcp)
    VALUES (api_create_attempt_chat_entry_v4.run_id, v_call_id, 'assistant', v_text_id, true, api_create_attempt_chat_entry_v4.mcp)
    RETURNING messages_entry.id INTO v_message_id;

    RETURN QUERY SELECT v_entry_id, v_call_id, v_message_id;
END; $$;
