-- Create attempt_chat entry with strongly-typed params + optional connections

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
    -- Optional connection ID arrays
    rubrics_ids uuid[] DEFAULT NULL,
    standards_ids uuid[] DEFAULT NULL,
    standard_groups_ids uuid[] DEFAULT NULL,
    departments_ids uuid[] DEFAULT NULL,
    personas_ids uuid[] DEFAULT NULL,
    problem_statements_ids uuid[] DEFAULT NULL,
    objectives_ids uuid[] DEFAULT NULL,
    questions_ids uuid[] DEFAULT NULL,
    options_ids uuid[] DEFAULT NULL,
    videos_ids uuid[] DEFAULT NULL,
    images_ids uuid[] DEFAULT NULL,
    documents_ids uuid[] DEFAULT NULL,
    parameter_fields_ids uuid[] DEFAULT NULL,
    tool_id uuid DEFAULT NULL,
    upload_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid, call_id uuid, message_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
    v_entry_id uuid;
    v_call_id uuid;
    v_text_id uuid;
    v_message_id uuid;
    v_persona_entry_ids uuid[];
BEGIN
    -- 1. Create text record
    INSERT INTO texts_entry (generated, mcp)
    VALUES (true, api_create_attempt_chat_entry_v4.mcp)
    RETURNING texts_entry.id INTO v_text_id;

    -- Link upload to text entry
    IF api_create_attempt_chat_entry_v4.upload_id IS NOT NULL THEN
        INSERT INTO text_uploads_entry (text_id, upload_id)
        VALUES (v_text_id, api_create_attempt_chat_entry_v4.upload_id);
    END IF;

    -- 2. Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (id, run_id, external_call_id)
    VALUES (v_call_id, api_create_attempt_chat_entry_v4.run_id, 'attempt_chat_' || v_call_id::text);

    -- 3. Link tool to call
    IF api_create_attempt_chat_entry_v4.tool_id IS NOT NULL THEN
        INSERT INTO tools_calls_connection (tools_id, call_id)
        VALUES (api_create_attempt_chat_entry_v4.tool_id, v_call_id);
    END IF;

    -- 4. Create entry
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

    -- 5. Optional connections: rubrics
    IF api_create_attempt_chat_entry_v4.rubrics_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_rubrics_connection (attempt_chat_id, rubrics_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.rubrics_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 6. Optional connections: standards
    IF api_create_attempt_chat_entry_v4.standards_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_standards_connection (attempt_chat_id, standards_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.standards_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 7. Optional connections: standard_groups
    IF api_create_attempt_chat_entry_v4.standard_groups_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_standard_groups_connection (attempt_chat_id, standard_groups_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.standard_groups_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 8. Optional connections: departments
    IF api_create_attempt_chat_entry_v4.departments_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_departments_connection (attempt_chat_id, departments_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.departments_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 9. Optional connections: personas (resource connection + entry creation + link)
    IF api_create_attempt_chat_entry_v4.personas_ids IS NOT NULL THEN
        -- Resource-level connection
        INSERT INTO attempt_chat_personas_connection (attempt_chat_id, personas_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.personas_ids)
        ON CONFLICT DO NOTHING;

        -- Create personas_entry for each, link via personas_personas_connection,
        -- and set assistant_persona_ids on the attempt_chat_entry
        WITH persona_resources AS (
            SELECT unnest(api_create_attempt_chat_entry_v4.personas_ids) AS personas_id
        ),
        new_entries AS (
            INSERT INTO personas_entry (active, generated, mcp)
            SELECT true, false, false
            FROM persona_resources
            RETURNING id
        ),
        paired AS (
            SELECT ne.id AS entry_id, pr.personas_id
            FROM (SELECT id, ROW_NUMBER() OVER () AS rn FROM new_entries) ne
            JOIN (SELECT personas_id, ROW_NUMBER() OVER () AS rn FROM persona_resources) pr
                ON ne.rn = pr.rn
        ),
        link_entries AS (
            INSERT INTO personas_personas_connection (personas_entry_id, personas_id)
            SELECT entry_id, personas_id FROM paired
        )
        SELECT ARRAY_AGG(entry_id) INTO v_persona_entry_ids FROM paired;

        UPDATE attempt_chat_entry
        SET assistant_persona_ids = v_persona_entry_ids
        WHERE id = v_entry_id;
    END IF;

    -- 10. Optional connections: problem_statements
    IF api_create_attempt_chat_entry_v4.problem_statements_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_problem_statements_connection (attempt_chat_id, problem_statements_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.problem_statements_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 11. Optional connections: objectives
    IF api_create_attempt_chat_entry_v4.objectives_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_objectives_connection (attempt_chat_id, objectives_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.objectives_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 12. Optional connections: questions
    IF api_create_attempt_chat_entry_v4.questions_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_questions_connection (attempt_chat_id, questions_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.questions_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 13. Optional connections: options
    IF api_create_attempt_chat_entry_v4.options_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_options_connection (attempt_chat_id, options_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.options_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 14. Optional connections: videos
    IF api_create_attempt_chat_entry_v4.videos_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_videos_connection (attempt_chat_id, videos_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.videos_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 15. Optional connections: images
    IF api_create_attempt_chat_entry_v4.images_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_images_connection (attempt_chat_id, images_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.images_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 16. Optional connections: documents
    IF api_create_attempt_chat_entry_v4.documents_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_documents_connection (attempt_chat_id, documents_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.documents_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 17. Optional connections: parameter_fields
    IF api_create_attempt_chat_entry_v4.parameter_fields_ids IS NOT NULL THEN
        INSERT INTO attempt_chat_parameter_fields_connection (attempt_chat_id, parameter_fields_id)
        SELECT v_entry_id, unnest(api_create_attempt_chat_entry_v4.parameter_fields_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 18. Create message
    INSERT INTO messages_entry (run_id, call_id, role, text_id, generated, mcp)
    VALUES (api_create_attempt_chat_entry_v4.run_id, v_call_id, 'assistant', v_text_id, true, api_create_attempt_chat_entry_v4.mcp)
    RETURNING messages_entry.id INTO v_message_id;

    RETURN QUERY SELECT v_entry_id, v_call_id, v_message_id;
END; $$;
