-- Query: get_session_timeline_view
-- Purpose: Unified event timeline for a single session

-- Step 1: Drop existing function
DO $$ BEGIN
    PERFORM p.oid FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'api_get_session_timeline_view_v4';
    IF FOUND THEN
        EXECUTE 'DROP FUNCTION public.api_get_session_timeline_view_v4';
    END IF;
END $$;

-- Step 2: Drop existing composite types
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT typname FROM pg_type
             JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid
             WHERE nspname = 'types' AND typname LIKE 'q_get_session_timeline_view_v4_%'
    LOOP EXECUTE format('DROP TYPE types.%I CASCADE', r.typname); END LOOP;
END $$;

-- Step 3: Create composite type

CREATE TYPE types.q_get_session_timeline_view_v4_item AS (
    event_type text,
    entity_id uuid,
    entity_name text,
    created_at timestamptz,
    extra_1 text,
    extra_2 text
);

-- Step 4: Create function

CREATE OR REPLACE FUNCTION api_get_session_timeline_view_v4(
    session_id_filter uuid
)
RETURNS TABLE (
    items types.q_get_session_timeline_view_v4_item[]
)
LANGUAGE sql STABLE
AS $$
    WITH
    all_events AS (
        -- Groups
        SELECT
            'group'::text AS event_type,
            g.group_id AS entity_id,
            g.group_name AS entity_name,
            g.group_created_at AS created_at,
            NULL::text AS extra_1,
            NULL::text AS extra_2
        FROM groups_mv g
        WHERE g.session_id = session_id_filter

        UNION ALL

        -- Logins
        SELECT
            'login'::text,
            l.login_id,
            NULL,
            l.created_at,
            NULL,
            NULL
        FROM logins_mv l
        WHERE l.session_id = session_id_filter

        UNION ALL

        -- Problems
        SELECT
            'problem'::text,
            p.id,
            p.type::text,
            p.created_at,
            p.message,
            NULL
        FROM problems_entry p
        WHERE p.session_id = session_id_filter

        UNION ALL

        -- Chats
        SELECT
            'chat'::text,
            c.id,
            c.name,
            c.created_at,
            NULL,
            NULL
        FROM chat_entry c
        WHERE c.active = true AND c.session_id = session_id_filter

        UNION ALL

        -- Attempts
        SELECT
            'attempt'::text,
            ah.attempt_id,
            NULL,
            ah.created_at,
            NULL,
            NULL
        FROM attempt_home_entry ah
        WHERE ah.active = true AND ah.session_id = session_id_filter

        UNION ALL

        -- Practices
        SELECT
            'practice'::text,
            pe.id,
            NULL,
            pe.created_at,
            NULL,
            NULL
        FROM practice_entry pe
        WHERE pe.active = true AND pe.session_id = session_id_filter
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (event_type, entity_id, entity_name, created_at, extra_1, extra_2)
                ::types.q_get_session_timeline_view_v4_item
                ORDER BY created_at ASC
            ),
            ARRAY[]::types.q_get_session_timeline_view_v4_item[]
        ) AS items
        FROM all_events
    )
    SELECT items FROM items_agg;
$$;
