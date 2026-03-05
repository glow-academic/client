-- ============================================================================
-- Query: resolve_attempt_chat
-- Purpose: Create attempt_chat_entry from chat_entry, copy connections, create bridge
-- Section: GENERATE/ATTEMPT
--
-- Given a chat_entry_id, attempt_id, department_id, and generate_* flags:
-- 1. Create attempt_chat_entry (copying denormalized columns from chat_entry)
-- 2. Copy always-needed connections (rubrics, standards, standard_groups, departments)
-- 3. Copy conditional connections (where generate_*=false)
-- 4. Create attempt_chat_bridge_entry (attempt ↔ attempt_chat)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_resolve_attempt_chat_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_resolve_attempt_chat_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_resolve_attempt_chat_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_resolve_attempt_chat_v4_result AS (
    attempt_chat_id uuid
);

CREATE OR REPLACE FUNCTION socket_resolve_attempt_chat_v4(
    p_attempt_id uuid,
    p_chat_entry_id uuid,
    p_department_id uuid,
    -- generate_* flags: when true, skip copying that connection (generation handles it)
    p_generate_personas boolean DEFAULT false,
    p_generate_problem_statements boolean DEFAULT false,
    p_generate_objectives boolean DEFAULT false,
    p_generate_questions boolean DEFAULT false,
    p_generate_options boolean DEFAULT false,
    p_generate_videos boolean DEFAULT false,
    p_generate_images boolean DEFAULT false,
    p_generate_documents boolean DEFAULT false,
    p_generate_parameter_fields boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_resolve_attempt_chat_v4_result[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_attempt_chat_id uuid;
BEGIN
    -- Step 1: Create attempt_chat_entry from chat_entry
    INSERT INTO attempt_chat_entry (
        chat_id,
        position, time_limit, negative_time,
        audio_enabled, text_enabled, hints_enabled, copy_paste_allowed,
        show_images, show_objectives, show_problem_statement,
        analyses_enabled, improvements_enabled, replacements_enabled, strengths_enabled,
        use_custom, use_previous,
        problem_statement_enabled, objectives_enabled, video_enabled,
        images_enabled, questions_enabled
    )
    SELECT
        ce.id,
        ce.position, ce.time_limit, ce.negative_time,
        ce.audio_enabled, ce.text_enabled, ce.hints_enabled, ce.copy_paste_allowed,
        ce.show_images, ce.show_objectives, ce.show_problem_statement,
        ce.analyses_enabled, ce.improvements_enabled, ce.replacements_enabled, ce.strengths_enabled,
        ce.use_custom, ce.use_previous,
        ce.problem_statement_enabled, ce.objectives_enabled, ce.video_enabled,
        ce.images_enabled, ce.questions_enabled
    FROM chat_entry ce
    WHERE ce.id = p_chat_entry_id
    RETURNING id INTO v_attempt_chat_id;

    IF v_attempt_chat_id IS NULL THEN
        RAISE EXCEPTION 'chat_entry not found: %', p_chat_entry_id;
    END IF;

    -- Step 2: Always-copied connections

    -- Rubrics
    INSERT INTO attempt_chat_rubrics_connection (attempt_chat_id, rubrics_id)
    SELECT v_attempt_chat_id, c.rubric_id
    FROM chat_rubrics_connection c
    WHERE c.chat_id = p_chat_entry_id AND c.active = true
    ON CONFLICT DO NOTHING;

    -- Standards
    INSERT INTO attempt_chat_standards_connection (attempt_chat_id, standards_id)
    SELECT v_attempt_chat_id, c.standard_id
    FROM chat_standards_connection c
    WHERE c.chat_id = p_chat_entry_id AND c.active = true
    ON CONFLICT DO NOTHING;

    -- Standard groups
    INSERT INTO attempt_chat_standard_groups_connection (attempt_chat_id, standard_groups_id)
    SELECT v_attempt_chat_id, c.standard_groups_id
    FROM chat_standard_groups_connection c
    WHERE c.chat_id = p_chat_entry_id AND c.active = true
    ON CONFLICT DO NOTHING;

    -- Departments
    INSERT INTO attempt_chat_departments_connection (attempt_chat_id, departments_id)
    SELECT v_attempt_chat_id, c.department_id
    FROM chat_departments_connection c
    WHERE c.chat_id = p_chat_entry_id AND c.active = true
    ON CONFLICT DO NOTHING;

    -- Step 3: Conditional copies (only when generate_*=false)

    IF NOT p_generate_personas THEN
        -- Copy resource-level persona connections
        INSERT INTO attempt_chat_personas_connection (attempt_chat_id, personas_id)
        SELECT v_attempt_chat_id, c.persona_id
        FROM chat_personas_connection c
        WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ON CONFLICT DO NOTHING;

        -- Create personas_entry for each persona resource, link via connection,
        -- and populate assistant_persona_ids on attempt_chat_entry
        WITH persona_resources AS (
            SELECT c.persona_id
            FROM chat_personas_connection c
            WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ),
        new_entries AS (
            INSERT INTO personas_entry (active, generated, mcp)
            SELECT true, false, false
            FROM persona_resources
            RETURNING id
        ),
        paired AS (
            SELECT ne.id AS entries_id, pr.persona_id
            FROM (SELECT id, ROW_NUMBER() OVER () AS rn FROM new_entries) ne
            JOIN (SELECT personas_id, ROW_NUMBER() OVER () AS rn FROM persona_resources) pr
                ON ne.rn = pr.rn
        ),
        link_entries AS (
            INSERT INTO personas_personas_connection (personas_entry_id, personas_id)
            SELECT entries_id, personas_id FROM paired
        )
        UPDATE attempt_chat_entry
        SET assistant_persona_ids = (SELECT ARRAY_AGG(entries_id) FROM paired)
        WHERE id = v_attempt_chat_id;
    END IF;

    IF NOT p_generate_problem_statements THEN
        INSERT INTO attempt_chat_problem_statements_connection (attempt_chat_id, problem_statements_id)
        SELECT v_attempt_chat_id, c.problem_statements_id
        FROM chat_problem_statements_connection c
        WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT p_generate_objectives THEN
        INSERT INTO attempt_chat_objectives_connection (attempt_chat_id, objectives_id)
        SELECT v_attempt_chat_id, c.objectives_id
        FROM chat_objectives_connection c
        WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT p_generate_questions THEN
        INSERT INTO attempt_chat_questions_connection (attempt_chat_id, questions_id)
        SELECT v_attempt_chat_id, c.question_id
        FROM chat_questions_connection c
        WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT p_generate_options THEN
        INSERT INTO attempt_chat_options_connection (attempt_chat_id, options_id)
        SELECT v_attempt_chat_id, c.option_id
        FROM chat_options_connection c
        WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT p_generate_videos THEN
        INSERT INTO attempt_chat_videos_connection (attempt_chat_id, videos_id)
        SELECT v_attempt_chat_id, c.video_id
        FROM chat_videos_connection c
        WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT p_generate_images THEN
        INSERT INTO attempt_chat_images_connection (attempt_chat_id, images_id)
        SELECT v_attempt_chat_id, c.image_id
        FROM chat_images_connection c
        WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT p_generate_documents THEN
        INSERT INTO attempt_chat_documents_connection (attempt_chat_id, documents_id)
        SELECT v_attempt_chat_id, c.document_id
        FROM chat_documents_connection c
        WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT p_generate_parameter_fields THEN
        INSERT INTO attempt_chat_parameter_fields_connection (attempt_chat_id, parameter_fields_id)
        SELECT v_attempt_chat_id, c.parameter_fields_id
        FROM chat_parameter_fields_connection c
        WHERE c.chat_id = p_chat_entry_id AND c.active = true
        ON CONFLICT DO NOTHING;
    END IF;

    -- Step 4: Create bridge (attempt ↔ attempt_chat)
    INSERT INTO attempt_chat_bridge_entry (attempt_id, attempt_chat_id)
    VALUES (p_attempt_id, v_attempt_chat_id)
    ON CONFLICT DO NOTHING;

    RETURN QUERY
    SELECT ARRAY[
        ROW(v_attempt_chat_id)::types.q_resolve_attempt_chat_v4_result
    ];
END;
$$;
