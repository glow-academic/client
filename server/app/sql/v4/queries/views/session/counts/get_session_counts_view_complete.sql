-- Query: get_session_counts_view
-- Purpose: Batch count chats, attempts, messages, and problems per session

-- Step 1: Drop existing function
DO $$ BEGIN
    PERFORM p.oid FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'api_get_session_counts_view_v4';
    IF FOUND THEN
        EXECUTE 'DROP FUNCTION public.api_get_session_counts_view_v4';
    END IF;
END $$;

-- Step 2: Drop existing composite types
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT typname FROM pg_type
             JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid
             WHERE nspname = 'types' AND typname LIKE 'q_get_session_counts_view_v4_%'
    LOOP EXECUTE format('DROP TYPE types.%I CASCADE', r.typname); END LOOP;
END $$;

-- Step 3: Create composite type

CREATE TYPE types.q_get_session_counts_view_v4_item AS (
    session_id uuid,
    chat_count int,
    attempt_count int,
    message_count int,
    problem_count int
);

-- Step 4: Create function

CREATE OR REPLACE FUNCTION api_get_session_counts_view_v4(
    session_ids_filter uuid[]
)
RETURNS TABLE (
    items types.q_get_session_counts_view_v4_item[]
)
LANGUAGE sql STABLE
AS $$
    WITH
    chat_counts AS (
        SELECT session_id, COUNT(*)::int AS cnt
        FROM chat_entry
        WHERE active = true AND session_id = ANY(session_ids_filter)
        GROUP BY session_id
    ),
    attempt_counts AS (
        SELECT session_id, COUNT(*)::int AS cnt
        FROM attempt_home_entry
        WHERE active = true AND session_id = ANY(session_ids_filter)
        GROUP BY session_id
    ),
    message_counts AS (
        SELECT b.session_id, COUNT(*)::int AS cnt
        FROM attempt_chat_bridge_entry b
        JOIN attempt_message_entry m ON m.chat_id = b.attempt_chat_id
        WHERE b.active = true AND b.session_id = ANY(session_ids_filter)
        GROUP BY b.session_id
    ),
    problem_counts AS (
        SELECT session_id, COUNT(*)::int AS cnt
        FROM problems_entry
        WHERE session_id = ANY(session_ids_filter)
        GROUP BY session_id
    ),
    combined AS (
        SELECT
            s.session_id,
            COALESCE(c.cnt, 0) AS chat_count,
            COALESCE(a.cnt, 0) AS attempt_count,
            COALESCE(msg.cnt, 0) AS message_count,
            COALESCE(p.cnt, 0) AS problem_count
        FROM unnest(session_ids_filter) AS s(session_id)
        LEFT JOIN chat_counts c ON c.session_id = s.session_id
        LEFT JOIN attempt_counts a ON a.session_id = s.session_id
        LEFT JOIN message_counts msg ON msg.session_id = s.session_id
        LEFT JOIN problem_counts p ON p.session_id = s.session_id
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (session_id, chat_count, attempt_count, message_count, problem_count)
                ::types.q_get_session_counts_view_v4_item
            ),
            ARRAY[]::types.q_get_session_counts_view_v4_item[]
        ) AS items
        FROM combined
    )
    SELECT items FROM items_agg;
$$;
