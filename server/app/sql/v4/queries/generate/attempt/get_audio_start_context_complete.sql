-- Lightweight chat → attempt resolver for audio/start.py
-- Only resolves chat_id to attempt_id and validates chat exists + active.
-- Config resources (provider, model, agent) come from get_attempt_websocket().

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_audio_start_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_audio_start_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_get_audio_start_context_v4(
    p_profile_id uuid,
    p_chat_id uuid
)
RETURNS TABLE (
    chat_exists boolean,
    chat_is_completed boolean,
    attempt_id uuid,
    attempt_is_active boolean
)
LANGUAGE sql
STABLE
AS $$
WITH chat_data AS (
    SELECT
        c.id as chat_id,
        c.attempt_id,
        EXISTS (
            SELECT 1 FROM simulation_completions_entry comp
            WHERE comp.chat_id = c.id AND comp.active = TRUE
        ) as chat_is_completed
    FROM simulation_chats_entry c
    WHERE c.id = p_chat_id AND c.active = TRUE
    LIMIT 1
),
attempt_data AS (
    SELECT
        a.id as attempt_id,
        a.active as attempt_is_active
    FROM simulation_attempts_entry a
    JOIN chat_data cd ON cd.attempt_id = a.id
    LIMIT 1
)
SELECT
    COALESCE(cd.chat_id IS NOT NULL, FALSE) as chat_exists,
    COALESCE(cd.chat_is_completed, FALSE) as chat_is_completed,
    atd.attempt_id,
    COALESCE(atd.attempt_is_active, FALSE) as attempt_is_active
FROM chat_data cd
LEFT JOIN attempt_data atd ON TRUE
$$;
