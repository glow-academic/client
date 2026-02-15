-- Get rate limit context for field generation validation
-- Agent/model/provider validation is now done in Python from pre-fetched resources
-- This SQL only provides rate limit data
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_field_generation_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_field_generation_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function (rate limit only)
CREATE OR REPLACE FUNCTION socket_get_field_generation_context_v4(
    p_profile_id uuid
)
RETURNS TABLE (
    requests_per_day integer,
    runs_today bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT p_profile_id AS profile_id
),
rate_limit_data AS (
    SELECT
        rl.requests_per_day
    FROM params p
    JOIN profile_artifact prof ON prof.id = p.profile_id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
),
runs_today_data AS (
    SELECT
        COUNT(*)::bigint as runs_today
    FROM params p
    JOIN profiles_runs_connection prj ON prj.profiles_id = p.profile_id
    JOIN runs_entry mr ON mr.id = prj.run_id
    WHERE mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
)
SELECT
    rld.requests_per_day,
    COALESCE(rtd.runs_today, 0) as runs_today
FROM params p
LEFT JOIN rate_limit_data rld ON TRUE
LEFT JOIN runs_today_data rtd ON TRUE
$$;
