-- Get all messages linked to a run (includes system/developer messages from previous runs)
-- Returns messages ordered by created_at
-- After migration 364: idx column removed, use created_at for ordering
-- Uses safe drop/recreate pattern
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_messages_by_run_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_messages_by_run_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuse message type from get_messages_by_ids
-- Recreate function
CREATE OR REPLACE FUNCTION socket_get_messages_by_run_id_v4(
    run_id uuid
)
RETURNS TABLE (
    messages types.i_get_messages_by_ids_v4_message[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT run_id AS run_id
),
-- Get first content per message (ordered by created_at)
first_content AS (
    SELECT DISTINCT ON (ce.message_id)
        ce.message_id,
        ce.content
    FROM attempt_content_entry ce
    WHERE ce.active = true
    ORDER BY ce.message_id, ce.created_at ASC
),
-- Get all messages linked to the run (includes system/developer from previous runs)
messages_data AS (
    SELECT
        m.id,
        m.role::text,
        fc.content,
        m.created_at,
        (mc.message_id IS NOT NULL) AS completed,
        ar.upload_id
    FROM params p
    JOIN messages_entry m ON m.run_id = p.run_id
    LEFT JOIN first_content fc ON fc.message_id = m.id
    LEFT JOIN audios_entry ar ON ar.message_id = m.id AND ar.active = true
    LEFT JOIN LATERAL (
        SELECT message_id FROM messages_completions_entry
        WHERE message_id = m.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
    ) mc ON true
    WHERE p.run_id IS NOT NULL
    ORDER BY m.created_at ASC  -- Order by creation time
)
SELECT
    COALESCE(
        ARRAY_AGG(
            (md.id, md.role, md.content, md.created_at, md.completed, md.upload_id)::types.i_get_messages_by_ids_v4_message
            ORDER BY md.created_at
        ),
        '{}'::types.i_get_messages_by_ids_v4_message[]
    ) as messages
FROM messages_data md
$$;
