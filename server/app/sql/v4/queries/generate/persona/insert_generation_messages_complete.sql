-- Insert pre-rendered developer and user messages for persona generation
-- Returns message_id for assistant response and ordered messages array
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_insert_generation_messages_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_insert_generation_messages_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create composite type for ordered messages if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'i_ordered_message_v4'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    ) THEN
        CREATE TYPE types.i_ordered_message_v4 AS (
            role text,
            content text
        );
    END IF;
END $$;

-- 3) Create the function
CREATE OR REPLACE FUNCTION socket_insert_generation_messages_v4(
    p_run_id uuid,
    p_developer_messages text[] DEFAULT NULL,  -- Pre-rendered (Jinja already applied)
    p_user_messages text[] DEFAULT NULL
)
RETURNS TABLE (
    message_id uuid,  -- ID for the current assistant message being generated
    messages jsonb    -- Ordered array of {role, content} for user/assistant messages
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        p_run_id AS run_id,
        p_developer_messages AS developer_messages,
        p_user_messages AS user_messages
),
-- Create developer messages from pre-rendered array (with content hash deduplication)
developer_message_content_array AS (
    SELECT
        t.content,
        p.run_id,
        t.idx
    FROM params p
    CROSS JOIN LATERAL unnest(p.developer_messages) WITH ORDINALITY AS t(content, idx)
    WHERE p.developer_messages IS NOT NULL
      AND array_length(p.developer_messages, 1) > 0
),
developer_message_hash_array AS (
    SELECT
        dmc.content,
        dmc.run_id,
        dmc.idx,
        message_content_hash(dmc.content, 'developer') as hash
    FROM developer_message_content_array dmc
),
existing_developer_messages AS (
    SELECT DISTINCT ON (dmh.hash)
        m.id as message_id,
        dmh.run_id,
        dmh.hash
    FROM messages_entry m
    JOIN contents_entry ce ON ce.message_id = m.id AND ce.idx = 0
    JOIN developer_message_hash_array dmh ON message_content_hash(ce.content, 'developer') = dmh.hash
    WHERE m.role = 'developer'
    ORDER BY dmh.hash, m.created_at DESC
),
new_developer_messages_data AS (
    SELECT
        dmh.content,
        dmh.run_id,
        dmh.idx,
        dmh.hash
    FROM developer_message_hash_array dmh
    WHERE NOT EXISTS (SELECT 1 FROM existing_developer_messages e WHERE e.hash = dmh.hash)
),
new_developer_messages AS (
    INSERT INTO general_messages_entry (role, completed, audio, run_id, created_at, updated_at)
    SELECT 'developer'::message_type, false, false, nd.run_id, NOW(), NOW()
    FROM new_developer_messages_data nd
    RETURNING id, run_id, created_at, updated_at
),
new_developer_messages_numbered AS (
    SELECT
        id as message_id,
        run_id,
        created_at,
        updated_at,
        ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM new_developer_messages
),
new_developer_messages_data_numbered AS (
    SELECT
        content,
        run_id,
        hash,
        idx,
        ROW_NUMBER() OVER (ORDER BY idx) as rn
    FROM new_developer_messages_data
),
new_developer_messages_matched AS (
    SELECT
        n.message_id,
        nd.content,
        n.run_id,
        nd.hash,
        n.created_at,
        n.updated_at
    FROM new_developer_messages_numbered n
    JOIN new_developer_messages_data_numbered nd ON n.rn = nd.rn
),
insert_developer_contents AS (
    INSERT INTO general_contents_entry (message_id, content, idx, created_at, updated_at)
    SELECT
        nd.message_id,
        nd.content,
        0,
        nd.created_at,
        nd.updated_at
    FROM new_developer_messages_matched nd
),
update_existing_developer_messages_run AS (
    UPDATE general_messages_entry m
    SET run_id = edm.run_id, updated_at = NOW()
    FROM existing_developer_messages edm
    WHERE m.id = edm.message_id AND edm.run_id IS NOT NULL
    RETURNING m.id as message_id, m.run_id
),
-- Create user messages from pre-rendered array (with content hash deduplication)
user_message_content_array AS (
    SELECT
        t.content,
        p.run_id,
        t.idx
    FROM params p
    CROSS JOIN LATERAL unnest(p.user_messages) WITH ORDINALITY AS t(content, idx)
    WHERE p.user_messages IS NOT NULL
      AND array_length(p.user_messages, 1) > 0
),
user_message_hash_array AS (
    SELECT
        umc.content,
        umc.run_id,
        umc.idx,
        message_content_hash(umc.content, 'user') as hash
    FROM user_message_content_array umc
),
existing_user_messages AS (
    SELECT DISTINCT ON (umh.hash)
        m.id as message_id,
        umh.run_id,
        umh.hash
    FROM messages_entry m
    JOIN contents_entry ce ON ce.message_id = m.id AND ce.idx = 0
    JOIN user_message_hash_array umh ON message_content_hash(ce.content, 'user') = umh.hash
    WHERE m.role = 'user'
    ORDER BY umh.hash, m.created_at DESC
),
new_user_messages_data AS (
    SELECT
        umh.content,
        umh.run_id,
        umh.idx,
        umh.hash
    FROM user_message_hash_array umh
    WHERE NOT EXISTS (SELECT 1 FROM existing_user_messages e WHERE e.hash = umh.hash)
),
new_user_messages AS (
    INSERT INTO general_messages_entry (role, completed, audio, run_id, created_at, updated_at)
    SELECT 'user'::message_type, false, false, nd.run_id, NOW(), NOW()
    FROM new_user_messages_data nd
    RETURNING id, run_id, created_at, updated_at
),
new_user_messages_numbered AS (
    SELECT
        id as message_id,
        run_id,
        created_at,
        updated_at,
        ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM new_user_messages
),
new_user_messages_data_numbered AS (
    SELECT
        content,
        run_id,
        hash,
        idx,
        ROW_NUMBER() OVER (ORDER BY idx) as rn
    FROM new_user_messages_data
),
new_user_messages_matched AS (
    SELECT
        n.message_id,
        nd.content,
        n.run_id,
        nd.hash,
        n.created_at,
        n.updated_at
    FROM new_user_messages_numbered n
    JOIN new_user_messages_data_numbered nd ON n.rn = nd.rn
),
insert_user_contents AS (
    INSERT INTO general_contents_entry (message_id, content, idx, created_at, updated_at)
    SELECT
        nd.message_id,
        nd.content,
        0,
        nd.created_at,
        nd.updated_at
    FROM new_user_messages_matched nd
),
update_existing_user_messages_run AS (
    UPDATE general_messages_entry m
    SET run_id = eum.run_id, updated_at = NOW()
    FROM existing_user_messages eum
    WHERE m.id = eum.message_id AND eum.run_id IS NOT NULL
    RETURNING m.id as message_id, m.run_id
),
-- Create assistant message for the response
create_assistant_message AS (
    INSERT INTO general_messages_entry (role, completed, audio, run_id, created_at, updated_at)
    SELECT 'assistant'::message_type, false, false, p.run_id, NOW(), NOW()
    FROM params p
    RETURNING id as message_id, run_id
),
-- Get all messages for this run (user and assistant only, ordered by created_at)
all_run_messages AS (
    SELECT
        m.id,
        m.role::text as role,
        ce.content,
        m.created_at
    FROM messages_entry m
    JOIN contents_entry ce ON ce.message_id = m.id AND ce.idx = 0
    CROSS JOIN params p
    WHERE m.run_id = p.run_id
      AND m.role IN ('user', 'assistant')
    ORDER BY m.created_at
),
-- Build messages jsonb array
messages_array AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'role', arm.role,
                    'content', arm.content
                )
                ORDER BY arm.created_at
            ),
            '[]'::jsonb
        ) as messages
    FROM all_run_messages arm
)
SELECT
    cam.message_id,
    ma.messages
FROM create_assistant_message cam
CROSS JOIN messages_array ma
$$;
