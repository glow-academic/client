-- Get messages for a specific group, with pagination
-- Join path: groups_mv → runs_mv → messages_mv
-- Only user/assistant messages (filters out system/developer)

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_auth_group_messages_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_group_messages_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITH CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_auth_group_messages_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_auth_group_messages_v4_message AS (
    message_id uuid,
    run_id uuid,
    role text,
    message_created_at timestamptz,
    text_upload_ids uuid[],
    audio_upload_ids uuid[],
    image_upload_ids uuid[],
    video_upload_ids uuid[],
    file_upload_ids uuid[],
    call_upload_ids uuid[]
);

CREATE TYPE types.q_get_auth_group_messages_v4_item AS (
    group_id uuid,
    group_name text,
    group_created_at timestamptz,
    session_id uuid,
    messages types.q_get_auth_group_messages_v4_message[],
    total_message_count bigint
);

-- 4) Create function
CREATE OR REPLACE FUNCTION api_get_auth_group_messages_v4(
    group_id_param uuid,
    page_limit_val int DEFAULT 50,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_auth_group_messages_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH group_info AS (
        SELECT
            g.group_id,
            g.name AS group_name,
            g.created_at AS group_created_at,
            g.session_id
        FROM groups_mv g
        WHERE g.group_id = group_id_param
    ),
    all_messages AS (
        SELECT
            m.message_id,
            m.run_id,
            m.role,
            m.message_created_at,
            m.text_upload_ids,
            m.audio_upload_ids,
            m.image_upload_ids,
            m.video_upload_ids,
            m.file_upload_ids,
            m.call_upload_ids
        FROM runs_mv r
        JOIN messages_mv m ON m.run_id = r.run_id
        WHERE r.group_id = group_id_param
          AND m.role IN ('user', 'assistant')
    ),
    total AS (
        SELECT COUNT(*) AS cnt FROM all_messages
    ),
    paged AS (
        SELECT *
        FROM all_messages
        ORDER BY message_created_at ASC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    assembled AS (
        SELECT
            gi.group_id,
            gi.group_name,
            gi.group_created_at,
            gi.session_id,
            COALESCE(
                ARRAY_AGG(
                    ROW(
                        p.message_id,
                        p.run_id,
                        p.role,
                        p.message_created_at,
                        p.text_upload_ids,
                        p.audio_upload_ids,
                        p.image_upload_ids,
                        p.video_upload_ids,
                        p.file_upload_ids,
                        p.call_upload_ids
                    )::types.q_get_auth_group_messages_v4_message
                    ORDER BY p.message_created_at ASC
                ) FILTER (WHERE p.message_id IS NOT NULL),
                ARRAY[]::types.q_get_auth_group_messages_v4_message[]
            ) AS messages,
            (SELECT cnt FROM total) AS total_message_count
        FROM group_info gi
        LEFT JOIN paged p ON TRUE
        GROUP BY gi.group_id, gi.group_name, gi.group_created_at, gi.session_id
    )
    SELECT
        COALESCE(
            ARRAY_AGG(
                ROW(
                    a.group_id,
                    a.group_name,
                    a.group_created_at,
                    a.session_id,
                    a.messages,
                    a.total_message_count
                )::types.q_get_auth_group_messages_v4_item
            ),
            ARRAY[]::types.q_get_auth_group_messages_v4_item[]
        ) AS items
    FROM assembled a;
$$;
