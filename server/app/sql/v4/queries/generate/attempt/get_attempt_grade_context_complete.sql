-- Get context data for attempt grade validation
-- Agent/model/provider validation is now done in Python from pre-fetched resources
-- This SQL only provides rate limit, simulation access, and attempt existence checks

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_attempt_grade_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_attempt_grade_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function (rate limit + access check only)
CREATE OR REPLACE FUNCTION socket_get_attempt_grade_context_v4(
    p_profile_id uuid,
    p_simulation_id uuid,
    p_attempt_id uuid
)
RETURNS TABLE (
    -- Rate limit context
    requests_per_day integer,
    runs_today bigint,

    -- Simulation context
    simulation_exists boolean,
    simulation_is_active boolean,
    simulation_id uuid,
    simulation_name text,

    -- Access context
    profile_has_access boolean,

    -- Attempt context
    attempt_exists boolean,
    attempt_id uuid,

    -- Group + chat context (for thin wrapper delegation)
    group_id uuid,
    chat_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_simulation_id AS simulation_id,
        p_attempt_id AS attempt_id
),
-- Rate limit
rate_limit_data AS (
    SELECT rl.requests_per_day
    FROM params p
    JOIN profile_artifact prof ON prof.id = p.profile_id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
),
runs_today_data AS (
    SELECT COUNT(*)::bigint as runs_today
    FROM params p
    JOIN profiles_runs_connection prj ON prj.profiles_id = p.profile_id
    JOIN runs_entry mr ON mr.id = prj.run_id
    WHERE mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Simulation data
simulation_data AS (
    SELECT
        s.id as simulation_id,
        TRUE as simulation_exists,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as simulation_name,
        EXISTS (
            SELECT 1 FROM simulation_flags_junction sf
            JOIN flags_resource f ON sf.flag_id = f.id
            WHERE sf.simulation_id = s.id AND f.name = 'simulation_active' AND sf.value = true
        ) as simulation_is_active
    FROM simulation_artifact s
    CROSS JOIN params p
    WHERE s.id = p.simulation_id
    LIMIT 1
),
-- Access check
access_data AS (
    SELECT EXISTS (
        SELECT 1
        FROM params p
        JOIN profile_cohorts_junction pc ON pc.profile_id = p.profile_id AND pc.active = true
        JOIN cohort_simulations_junction cs ON cs.cohort_id = pc.cohort_id AND cs.active = true
        WHERE cs.simulation_id = p.simulation_id
    ) as has_access
),
-- Attempt data
attempt_data AS (
    SELECT
        a.id as attempt_id,
        TRUE as attempt_exists
    FROM attempt_entry a
    CROSS JOIN params p
    WHERE a.id = p.attempt_id
    LIMIT 1
),
-- Chat + group data (first active chat for this attempt)
chat_data AS (
    SELECT
        sc.id as chat_id,
        sc.group_id
    FROM attempt_chat_entry sc
    CROSS JOIN params p
    WHERE sc.attempt_id = p.attempt_id
      AND sc.active = TRUE
    ORDER BY sc.created_at ASC
    LIMIT 1
)
SELECT
    rld.requests_per_day,
    COALESCE(rtd.runs_today, 0),
    COALESCE(sd.simulation_exists, FALSE),
    COALESCE(sd.simulation_is_active, FALSE),
    sd.simulation_id,
    sd.simulation_name,
    COALESCE(acd.has_access, FALSE),
    COALESCE(atd.attempt_exists, FALSE),
    atd.attempt_id,
    chtd.group_id,
    chtd.chat_id
FROM params p
LEFT JOIN rate_limit_data rld ON TRUE
LEFT JOIN runs_today_data rtd ON TRUE
LEFT JOIN simulation_data sd ON TRUE
LEFT JOIN access_data acd ON TRUE
LEFT JOIN attempt_data atd ON TRUE
LEFT JOIN chat_data chtd ON TRUE
$$;
