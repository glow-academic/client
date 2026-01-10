-- Get all messages linked to a run (includes system/developer messages from previous runs)
-- Returns messages ordered by created_at
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
-- Get all messages linked to the run (includes system/developer from previous runs)
messages_data AS (
    SELECT 
        m.id,
        m.role::text,
        cnt.content,
        m.created_at,
        m.completed,
        m.audio,
        au.upload_id
    FROM params p
    JOIN message_runs mr ON mr.run_id = p.run_id
    JOIN message m ON m.id = mr.message_id
    LEFT JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN contents cnt ON cnt.id = mc.content_id
    LEFT JOIN message_audios ma ON ma.message_id = m.id
    LEFT JOIN audio_uploads au ON au.audio_id = ma.audio_id AND au.active = true
    WHERE p.run_id IS NOT NULL
    ORDER BY m.created_at ASC  -- Order by creation time
)
SELECT 
    COALESCE(
        ARRAY_AGG(
            (md.id, md.role, md.content, md.created_at, md.completed, md.audio, COALESCE(au.upload_id, NULL::uuid))::types.i_get_messages_by_ids_v4_message
            ORDER BY md.created_at
        ),
        '{}'::types.i_get_messages_by_ids_v4_message[]
    ) as messages
FROM messages_data md
LEFT JOIN message_audios ma2 ON ma2.message_id = md.id
LEFT JOIN audio_uploads au ON au.audio_id = ma2.audio_id AND au.active = true
$$;

