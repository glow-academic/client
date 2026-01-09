-- Hint tool complete handler - consolidated function that gets message_id and creates hints atomically
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_hint_tool_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_hint_tool_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_hint_tool_complete_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_hint_tool_complete_v4_hint_result AS (
    simulation_message_id uuid,
    idx int,
    hint text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_hint_tool_complete_v4(
    run_id uuid,
    chat_id uuid,
    hint_texts text[]
)
RETURNS TABLE (
    message_id uuid,
    hints types.i_hint_tool_complete_v4_hint_result[]
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_message_id uuid;
    v_hints types.i_hint_tool_complete_v4_hint_result[];
BEGIN
    -- Get message_id from run_id and chat_id (same logic as get_hint_message_id_complete.sql)
    SELECT m.id INTO v_message_id
    FROM message_runs mr
    JOIN messages m ON m.id = mr.message_id
    JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN chat_groups cg ON cg.group_id IN (
        SELECT gr.group_id 
        FROM group_runs gr 
        WHERE gr.run_id = run_id
    )
    JOIN chats c ON c.id = cg.chat_id
    WHERE mr.run_id = run_id
      AND c.id = chat_id
      AND m.role = 'user'::message_role
    ORDER BY m.created_at DESC
    LIMIT 1;

    -- If no message_id found, return empty result
    IF v_message_id IS NULL THEN
        RETURN QUERY SELECT NULL::uuid, '{}'::types.i_hint_tool_complete_v4_hint_result[];
        RETURN;
    END IF;

    -- Create hints for that message_id (same logic as create_hints_complete.sql)
    WITH hint_texts_array AS (
        SELECT 
            t.hint_text,
            t.idx
        FROM unnest(hint_texts) WITH ORDINALITY AS t(hint_text, idx)
        WHERE trim(t.hint_text) != ''
    ),
    hints_with_next_idx AS (
        SELECT 
            hta.hint_text,
            hta.idx as original_idx,
            COALESCE(
                (SELECT MAX(mh.idx) FROM message_hints mh WHERE mh.message_id = v_message_id),
                -1
            ) + ROW_NUMBER() OVER (ORDER BY hta.idx) as next_idx
        FROM hint_texts_array hta
    ),
    inserted_hint_entities AS (
        INSERT INTO hints (hint, created_at, updated_at)
        SELECT DISTINCT
            hwni.hint_text,
            NOW(),
            NOW()
        FROM hints_with_next_idx hwni
        ON CONFLICT DO NOTHING
        RETURNING id, hint
    ),
    inserted_hints AS (
        INSERT INTO message_hints (message_id, hint_id, idx, created_at, updated_at)
        SELECT 
            v_message_id,
            ihe.id,
            hwni.next_idx,
            NOW(),
            NOW()
        FROM hints_with_next_idx hwni
        JOIN inserted_hint_entities ihe ON ihe.hint = hwni.hint_text
        RETURNING message_id, idx, (SELECT hint FROM hints WHERE id = hint_id) as hint
    )
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (simulation_message_id, idx, hint)::types.i_hint_tool_complete_v4_hint_result
                ORDER BY idx
            ),
            '{}'::types.i_hint_tool_complete_v4_hint_result[]
        ) INTO v_hints
    FROM inserted_hints;

    -- Return result
    RETURN QUERY SELECT v_message_id, v_hints;
END;
$$;

