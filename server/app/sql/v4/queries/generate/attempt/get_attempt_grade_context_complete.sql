-- Get context data for attempt grade (grading) validation
-- Validates attempt exists and is accessible for grading

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

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_get_attempt_grade_context_v4(
    p_profile_id uuid,
    p_simulation_id uuid,
    p_attempt_id uuid,
    p_chat_id uuid DEFAULT NULL,
    p_entry_types text[] DEFAULT NULL
)
RETURNS TABLE (
    -- Agent context
    agent_exists boolean,
    agent_name text,
    agent_is_active boolean,

    -- Model context
    model_id uuid,
    model_name text,

    -- Provider context
    provider_id uuid,
    provider_name text,

    -- API key context
    has_api_key boolean,

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

    -- Entry types
    valid_entry_types text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_simulation_id AS simulation_id,
        p_attempt_id AS attempt_id,
        p_chat_id AS chat_id,
        p_entry_types AS entry_types
),
-- Resolve chat_id (use provided or first chat from attempt)
effective_chat AS (
    SELECT COALESCE(p_chat_id, c.id) as chat_id
    FROM simulation_chats_entry c
    WHERE c.attempt_id = p_attempt_id
    ORDER BY c.created_at ASC
    LIMIT 1
),
-- Resolve agent from latest run's config (via simulation_chats_entry.group_id)
resolved_agent AS (
    SELECT aaj.agent_id
    FROM effective_chat ec
    JOIN simulation_chats_entry sc ON sc.id = ec.chat_id
    JOIN runs_entry r ON r.group_id = sc.group_id
    JOIN config_agents_connection cac ON cac.config_id = r.config_id AND cac.active = true
    JOIN agent_agents_junction aaj ON aaj.agents_id = cac.agents_id AND aaj.active = true
    ORDER BY r.created_at DESC
    LIMIT 1
),
-- Agent data (grading agent, resolved from stored group)
agent_data AS (
    SELECT
        a.id as agent_id,
        TRUE as agent_exists,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        EXISTS (
            SELECT 1 FROM agent_flags_junction af
            JOIN flags_resource f ON af.flag_id = f.id
            WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true
        ) as agent_is_active
    FROM agent_artifact a
    JOIN resolved_agent ra ON ra.agent_id = a.id
    LIMIT 1
),
-- Model data
model_data AS (
    SELECT mr.id as model_id, mr.value as model_name, pr.key as model_key, pr.id as provider_id
    FROM resolved_agent ra
    JOIN agent_agents_junction aaj ON aaj.agent_id = ra.agent_id
    JOIN agents_resource ar ON ar.id = aaj.agents_id
    JOIN models_resource mr ON mr.id = ar.model_id
    LEFT JOIN providers_resource pr ON pr.id = mr.provider_id
    LIMIT 1
),
-- Provider data
provider_data AS (
    SELECT
        md.provider_id as provider_id,
        (SELECT n.name FROM provider_providers_junction ppj JOIN provider_names_junction pn ON pn.provider_id = ppj.provider_id JOIN names_resource n ON pn.name_id = n.id WHERE ppj.providers_id = md.provider_id LIMIT 1) as provider_name
    FROM model_data md
    LIMIT 1
),
-- API key check
api_key_check AS (
    SELECT (md.model_key IS NOT NULL AND md.model_key != '') as has_api_key
    FROM model_data md
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
    JOIN profile_runs_junction prj ON prj.profile_id = p.profile_id
    JOIN view_runs_entry mr ON mr.id = prj.run_id
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
    FROM view_attempts_entry a
    CROSS JOIN params p
    WHERE a.id = p.attempt_id
    LIMIT 1
),
-- Valid entry types
valid_entries AS (
    SELECT ARRAY_AGG(br.entry::text) as valid_types
    FROM params p
    JOIN bindings_resource br ON (p.entry_types IS NULL OR br.entry::text = ANY(p.entry_types))
    WHERE br.active = true AND br.creatable = true
)
SELECT
    COALESCE(ad.agent_exists, FALSE),
    ad.agent_name,
    COALESCE(ad.agent_is_active, FALSE),
    md.model_id,
    md.model_name,
    pd.provider_id,
    pd.provider_name,
    COALESCE(akc.has_api_key, FALSE),
    rld.requests_per_day,
    COALESCE(rtd.runs_today, 0),
    COALESCE(sd.simulation_exists, FALSE),
    COALESCE(sd.simulation_is_active, FALSE),
    sd.simulation_id,
    sd.simulation_name,
    COALESCE(acd.has_access, FALSE),
    COALESCE(atd.attempt_exists, FALSE),
    atd.attempt_id,
    ve.valid_types
FROM params p
LEFT JOIN agent_data ad ON TRUE
LEFT JOIN model_data md ON TRUE
LEFT JOIN provider_data pd ON TRUE
LEFT JOIN api_key_check akc ON TRUE
LEFT JOIN rate_limit_data rld ON TRUE
LEFT JOIN runs_today_data rtd ON TRUE
LEFT JOIN simulation_data sd ON TRUE
LEFT JOIN access_data acd ON TRUE
LEFT JOIN attempt_data atd ON TRUE
LEFT JOIN valid_entries ve ON TRUE
$$;
