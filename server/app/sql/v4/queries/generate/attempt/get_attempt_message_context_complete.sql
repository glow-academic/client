-- Get context data for attempt message validation
-- Extends generation context with attempt/chat state checks

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_attempt_message_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_attempt_message_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_get_attempt_message_context_v4(
    p_profile_id uuid,
    p_agent_id uuid,
    p_simulation_id uuid,
    p_chat_id uuid,
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
    attempt_is_active boolean,
    attempt_id uuid,

    -- Chat context
    chat_exists boolean,
    chat_is_completed boolean,
    chat_id uuid,
    hints_enabled boolean,

    -- Entry types
    valid_entry_types text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_agent_id AS agent_id,
        p_simulation_id AS simulation_id,
        p_chat_id AS chat_id,
        p_entry_types AS entry_types
),
-- Agent data
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
    CROSS JOIN params p
    WHERE a.id = p.agent_id
    LIMIT 1
),
-- Model data
model_data AS (
    SELECT
        mr.id as model_id,
        mr.value as model_name,
        ma.id as model_artifact_id
    FROM params p
    JOIN agent_models_junction am ON am.agent_id = p.agent_id
    JOIN model_artifact ma ON ma.id = am.model_id
    JOIN model_models_junction mmj ON mmj.model_id = ma.id
    JOIN models_resource mr ON mr.id = mmj.models_id
    LIMIT 1
),
-- Provider data
provider_data AS (
    SELECT
        p_prov.id as provider_id,
        (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = p_prov.id LIMIT 1) as provider_name
    FROM model_data md
    JOIN model_providers_junction mp ON mp.model_id = md.model_artifact_id
    JOIN providers_resource p_res ON p_res.id = mp.providers_id
    JOIN provider_providers_junction ppj ON ppj.providers_id = p_res.id
    JOIN provider_artifact p_prov ON p_prov.id = ppj.provider_id
    LIMIT 1
),
-- Settings and API key check
profile_primary_department AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id
    WHERE pd.is_primary = TRUE AND pd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys_junction spk
    JOIN keys_resource kr ON kr.id = spk.key_id
    WHERE spk.active = true AND kr.active
),
active_settings AS (
    SELECT COALESCE(
        (SELECT s.id FROM setting_artifact s
         JOIN department_settings_junction sd ON sd.settings_id = s.id
         JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
         JOIN settings_with_keys swk ON swk.settings_id = s.id
         WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
         AND sd.active = true LIMIT 1),
        (SELECT settings_id FROM settings_with_keys LIMIT 1)
    ) as settings_id
),
api_key_check AS (
    SELECT EXISTS (
        SELECT 1
        FROM model_data md
        JOIN model_providers_junction mp ON mp.model_id = md.model_artifact_id
        CROSS JOIN active_settings act_s
        JOIN setting_provider_keys_junction spk ON spk.providers_id = mp.providers_id
            AND spk.settings_id = act_s.settings_id AND spk.active = true
        JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active = true
    ) as has_api_key
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
    JOIN runs_entry mr ON mr.id = prj.run_id
    WHERE mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Simulation data
-- p_simulation_id is a simulations_resource.id, need to join to simulation_artifact via simulation_simulations_junction
simulation_data AS (
    SELECT
        sa.id as simulation_id,
        TRUE as simulation_exists,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = sa.id LIMIT 1) as simulation_name,
        EXISTS (
            SELECT 1 FROM simulation_flags_junction sf
            JOIN flags_resource f ON sf.flag_id = f.id
            WHERE sf.simulation_id = sa.id AND f.name = 'simulation_active' AND sf.value = true
        ) as simulation_is_active
    FROM params p
    JOIN simulations_resource sr ON sr.id = p.simulation_id
    JOIN simulation_simulations_junction ssj ON ssj.simulations_id = sr.id
    JOIN simulation_artifact sa ON sa.id = ssj.simulation_id
    LIMIT 1
),
-- Access check
-- cohort_simulations_junction.simulation_id references simulations_resource.id
access_data AS (
    SELECT EXISTS (
        SELECT 1
        FROM params p
        JOIN profile_cohorts_junction pc ON pc.profile_id = p.profile_id AND pc.active = true
        JOIN cohort_simulations_junction cs ON cs.cohort_id = pc.cohort_id AND cs.active = true
        WHERE cs.simulation_id = p.simulation_id
    ) as has_access
),
-- Chat data (chat has attempt_id directly)
chat_data AS (
    SELECT
        c.id as chat_id,
        TRUE as chat_exists,
        COALESCE(c.completed, FALSE) as chat_is_completed,
        c.attempt_id,
        c.hints_enabled
    FROM simulation_chats_entry c
    CROSS JOIN params p
    WHERE c.id = p.chat_id
    LIMIT 1
),
-- Attempt data
attempt_data AS (
    SELECT
        a.id as attempt_id,
        TRUE as attempt_exists,
        a.active as attempt_is_active
    FROM simulation_attempts_entry a
    JOIN chat_data cd ON cd.attempt_id = a.id
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
    COALESCE(atd.attempt_is_active, TRUE),
    atd.attempt_id,
    COALESCE(cd.chat_exists, FALSE),
    COALESCE(cd.chat_is_completed, FALSE),
    cd.chat_id,
    COALESCE(cd.hints_enabled, FALSE),
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
LEFT JOIN chat_data cd ON TRUE
LEFT JOIN attempt_data atd ON TRUE
LEFT JOIN valid_entries ve ON TRUE
$$;
