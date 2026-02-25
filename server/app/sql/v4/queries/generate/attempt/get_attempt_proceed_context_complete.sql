-- ============================================================================
-- Query: get_attempt_proceed_context
-- Purpose: Resolve all context needed by attempt_proceed in a single query
-- Section: GENERATE/ATTEMPT
--
-- Given an attempt_id + profile_id, returns:
--   - num_chats, completed_count (done check)
--   - next chat_entry_id by position (NULL if all done)
--   - resolved department_id (from chat departments, fallback to profile primary)
--   - name, description (prefilled scenario defaults)
--   - use_custom, use_previous (behavior flags)
--   - all 11 generate_* flags from the next chat_entry
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_attempt_proceed_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_attempt_proceed_context_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_attempt_proceed_context_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_attempt_proceed_context_v4_result AS (
    num_chats int,
    completed_count int,
    chat_entry_id uuid,
    department_id uuid,
    -- prefilled name/description from chat_entry (scenario defaults)
    name text,
    description text,
    -- behavior flags from chat_entry
    use_custom boolean,
    use_previous boolean,
    -- generate flags from chat_entry
    generate_problem_statements boolean,
    generate_objectives boolean,
    generate_videos boolean,
    generate_images boolean,
    generate_questions boolean,
    generate_names boolean,
    generate_descriptions boolean,
    generate_personas boolean,
    generate_documents boolean,
    generate_options boolean,
    generate_parameter_fields boolean
);

CREATE OR REPLACE FUNCTION socket_get_attempt_proceed_context_v4(
    p_attempt_id uuid,
    p_profile_id uuid
)
RETURNS TABLE (
    items types.q_get_attempt_proceed_context_v4_result[]
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_num_chats int;
    v_completed_count int;
    v_next_chat_entry_id uuid;
    v_department_id uuid;
    v_dept_count int;
    v_profile_dept_id uuid;
    v_result types.q_get_attempt_proceed_context_v4_result;
BEGIN
    -- 1. Get num_chats from attempt_entry
    SELECT a.num_chats INTO v_num_chats
    FROM attempt_entry a
    WHERE a.id = p_attempt_id AND a.active = true;

    IF v_num_chats IS NULL THEN
        RAISE EXCEPTION 'Attempt not found: %', p_attempt_id;
    END IF;

    -- 2. Count completed chats
    SELECT COUNT(*)::int INTO v_completed_count
    FROM attempt_chat_bridge_entry acb
    WHERE acb.attempt_id = p_attempt_id AND acb.active = true;

    -- 3. Find next chat_entry by position (not yet resolved for this attempt)
    SELECT ce.id INTO v_next_chat_entry_id
    FROM chat_entry ce
    JOIN (
        -- All chat_entry IDs from parent
        SELECT hce.chat_id
        FROM attempt_home_entry ahe
        JOIN home_chat_entry hce ON hce.home_id = ahe.home_id AND hce.active = true
        WHERE ahe.attempt_id = p_attempt_id AND ahe.active = true

        UNION ALL

        SELECT pce.chat_id
        FROM attempt_practice_entry ape
        JOIN practice_chat_entry pce ON pce.practice_id = ape.practice_id AND pce.active = true
        WHERE ape.attempt_id = p_attempt_id AND ape.active = true
    ) parent_chats ON parent_chats.chat_id = ce.id
    WHERE ce.active = true
      AND ce.id NOT IN (
          -- Already resolved for this attempt
          SELECT ace.chat_id
          FROM attempt_chat_bridge_entry acb2
          JOIN attempt_chat_entry ace ON ace.id = acb2.attempt_chat_id AND ace.active = true
          WHERE acb2.attempt_id = p_attempt_id AND acb2.active = true
      )
    ORDER BY ce.position, ce.created_at
    LIMIT 1;

    -- If no next chat, return with NULLs (caller checks completed_count >= num_chats)
    IF v_next_chat_entry_id IS NULL THEN
        RETURN QUERY
        SELECT ARRAY[
            ROW(v_num_chats, v_completed_count,
                NULL::uuid, NULL::uuid,
                ''::text, ''::text,
                false, false,
                false, false, false, false, false,
                false, false, false, false, false, false
            )::types.q_get_attempt_proceed_context_v4_result
        ];
        RETURN;
    END IF;

    -- 4. Resolve department_id from chat_departments_connection
    SELECT COUNT(*)::int INTO v_dept_count
    FROM chat_departments_connection cdc
    WHERE cdc.chat_id = v_next_chat_entry_id AND cdc.active = true;

    IF v_dept_count = 1 THEN
        -- Exactly one department — use it
        SELECT cdc.departments_id INTO v_department_id
        FROM chat_departments_connection cdc
        WHERE cdc.chat_id = v_next_chat_entry_id AND cdc.active = true
        LIMIT 1;
    ELSE
        -- 0 or >1: fall back to profile's primary department
        SELECT pdj.departments_id INTO v_profile_dept_id
        FROM profile_departments_junction pdj
        WHERE pdj.profile_id = p_profile_id AND pdj.active = true
        ORDER BY pdj.created_at
        LIMIT 1;

        IF v_dept_count > 1 THEN
            -- Verify profile department is in the chat's list
            IF NOT EXISTS (
                SELECT 1
                FROM chat_departments_connection cdc
                WHERE cdc.chat_id = v_next_chat_entry_id
                  AND cdc.active = true
                  AND cdc.departments_id = v_profile_dept_id
            ) THEN
                RAISE EXCEPTION 'Profile department % not in chat department list', v_profile_dept_id;
            END IF;
        END IF;

        v_department_id := v_profile_dept_id;
    END IF;

    -- 5. Build result with name, description, behavior flags, and generate flags from chat_entry
    SELECT ROW(
        v_num_chats, v_completed_count,
        v_next_chat_entry_id, v_department_id,
        ce.name, ce.description,
        ce.use_custom, ce.use_previous,
        ce.generate_problem_statements,
        ce.generate_objectives,
        ce.generate_videos,
        ce.generate_images,
        ce.generate_questions,
        ce.generate_names,
        ce.generate_descriptions,
        ce.generate_personas,
        ce.generate_documents,
        ce.generate_options,
        ce.generate_parameter_fields
    )::types.q_get_attempt_proceed_context_v4_result
    INTO v_result
    FROM chat_entry ce
    WHERE ce.id = v_next_chat_entry_id;

    RETURN QUERY
    SELECT ARRAY[v_result];
END;
$$;
