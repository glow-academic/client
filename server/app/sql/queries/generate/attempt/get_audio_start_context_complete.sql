-- Lightweight chat → attempt resolver for audio/start.py
-- Resolves chat_id to attempt_id, validates chat exists + active, and checks rate limits.
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
    attempt_is_active boolean,
    requests_per_day integer,
    runs_today bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_chat_id AS chat_id
),
rate_limit_data AS (
    SELECT rl.requests_per_day
    FROM params p
    JOIN profile_artifact prof ON prof.id = p.profile_id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limits_id = rl.id
),
runs_today_data AS (
    SELECT COUNT(*)::bigint as runs_today
    FROM params p
    JOIN profiles_runs_connection prj ON prj.profiles_id = p.profile_id
    JOIN runs_entry mr ON mr.id = prj.run_id
    WHERE mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
chat_data AS (
    SELECT
        c.id as chat_id,
        ac.attempt_id,
        EXISTS (
            SELECT 1 FROM attempt_completion_entry comp
            WHERE comp.chat_id = c.id AND comp.active = TRUE
        ) as chat_is_completed
    FROM attempt_chat_entry c
    JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
    WHERE c.id = p_chat_id AND c.active = TRUE
    LIMIT 1
),
attempt_data AS (
    SELECT
        a.id as attempt_id,
        a.active as attempt_is_active
    FROM attempt_entry a
    JOIN chat_data cd ON cd.attempt_id = a.id
    LIMIT 1
)
SELECT
    COALESCE(cd.chat_id IS NOT NULL, FALSE) as chat_exists,
    COALESCE(cd.chat_is_completed, FALSE) as chat_is_completed,
    atd.attempt_id,
    COALESCE(atd.attempt_is_active, FALSE) as attempt_is_active,
    rld.requests_per_day,
    COALESCE(rtd.runs_today, 0)
FROM params p
LEFT JOIN rate_limit_data rld ON TRUE
LEFT JOIN runs_today_data rtd ON TRUE
LEFT JOIN chat_data cd ON TRUE
LEFT JOIN attempt_data atd ON TRUE
$$;
