-- Get messages by message_ids array
-- Returns messages in order of message_ids array
-- After migration 364: idx column removed, use created_at for ordering
-- Uses safe drop/recreate pattern
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_messages_by_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_messages_by_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop type if exists (before recreating)
DROP TYPE IF EXISTS types.i_get_messages_by_ids_v4_message CASCADE;

-- Create composite type for message
CREATE TYPE types.i_get_messages_by_ids_v4_message AS (
    id uuid,
    role text,
    content text,
    created_at timestamptz,
    completed boolean,
    audio boolean,
    upload_id uuid
);

-- Recreate function
CREATE OR REPLACE FUNCTION socket_get_messages_by_ids_v4(
    message_ids uuid[]
)
RETURNS TABLE (
    messages types.i_get_messages_by_ids_v4_message[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT message_ids AS message_ids
),
-- Get first content per message (ordered by created_at)
first_content AS (
    SELECT DISTINCT ON (ce.message_id)
        ce.message_id,
        ce.content
    FROM simulation_contents_entry ce
    WHERE ce.active = true
    ORDER BY ce.message_id, ce.created_at ASC
),
-- Get messages in order of message_ids array
messages_data AS (
    SELECT
        m.id,
        m.role::text,
        fc.content,
        m.created_at,
        m.completed,
        m.audio,
        ar.upload_id,
        array_position(p.message_ids, m.id) as pos
    FROM params p
    CROSS JOIN unnest(p.message_ids) AS msg_id
    JOIN messages_entry m ON m.id = msg_id
    LEFT JOIN first_content fc ON fc.message_id = m.id
    LEFT JOIN calls_entry c_audio ON c_audio.run_id = m.run_id
    LEFT JOIN audios_entry ar ON ar.call_id = c_audio.id AND ar.active = true
    WHERE p.message_ids IS NOT NULL
      AND array_length(p.message_ids, 1) > 0
)
SELECT
    COALESCE(
        ARRAY_AGG(
            (md.id, md.role, md.content, md.created_at, md.completed, md.audio, md.upload_id)::types.i_get_messages_by_ids_v4_message
            ORDER BY md.pos
        ),
        '{}'::types.i_get_messages_by_ids_v4_message[]
    ) as messages
FROM messages_data md
$$;
