-- Get context data for parameter generation validation
-- This SQL fetches RAW DATA only - no business logic
-- Python applies the validation rules in permissions.py
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_parameter_generation_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_parameter_generation_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_get_parameter_generation_context_v4(
    p_profile_id uuid,
    p_agent_id uuid
)
RETURNS TABLE (
    -- Agent context
    agent_exists boolean,
    agent_name text,
    agent_is_active boolean,

    -- Model context (via junction traversal)
    model_id uuid,
    model_name text,

    -- Provider context (via full junction chain)
    provider_id uuid,
    provider_name text,

    -- API key context
    has_api_key boolean,

    -- Rate limit context (raw data, not computed)
    requests_per_day integer,  -- NULL = unlimited
    runs_today bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_agent_id AS agent_id
),
-- Check if agent exists
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
-- Get model via denormalized agents_resource.model_id
model_data AS (
    SELECT mr.id as model_id, mr.value as model_name, mr.provider_id as provider_id
    FROM params p
    JOIN agent_agents_junction aaj ON aaj.agent_id = p.agent_id
    JOIN agents_resource ar ON ar.id = aaj.agents_id
    JOIN models_resource mr ON mr.id = ar.model_id
    LIMIT 1
),
-- Get provider via models_resource.provider_id
provider_data AS (
    SELECT
        pr.id as providers_resource_id,
        pr.key as provider_key,
        (SELECT n.name FROM provider_providers_junction ppj JOIN provider_names_junction pn ON pn.provider_id = ppj.provider_id JOIN names_resource n ON pn.name_id = n.id WHERE ppj.providers_id = pr.id AND ppj.active = true LIMIT 1) as provider_name
    FROM model_data md
    JOIN providers_resource pr ON pr.id = md.provider_id
    LIMIT 1
),
-- Check if provider has API key (on providers_resource.key)
api_key_check AS (
    SELECT (pd.provider_key IS NOT NULL AND pd.provider_key != '') as has_api_key
    FROM provider_data pd
),
-- Get rate limit for profile (raw data)
rate_limit_data AS (
    SELECT
        rl.requests_per_day
    FROM params p
    JOIN profile_artifact prof ON prof.id = p.profile_id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
),
-- Count runs today
runs_today_data AS (
    SELECT
        COUNT(*)::bigint as runs_today
    FROM params p
    JOIN profiles_runs_connection prj ON prj.profiles_id = p.profile_id
    JOIN runs_entry mr ON mr.id = prj.run_id
    WHERE mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
)
SELECT
    COALESCE(ad.agent_exists, FALSE) as agent_exists,
    ad.agent_name,
    COALESCE(ad.agent_is_active, FALSE) as agent_is_active,
    md.model_id,
    md.model_name,
    pd.providers_resource_id as provider_id,
    pd.provider_name,
    COALESCE(akc.has_api_key, FALSE) as has_api_key,
    rld.requests_per_day,
    COALESCE(rtd.runs_today, 0) as runs_today
FROM params p
LEFT JOIN agent_data ad ON TRUE
LEFT JOIN model_data md ON TRUE
LEFT JOIN provider_data pd ON TRUE
LEFT JOIN api_key_check akc ON TRUE
LEFT JOIN rate_limit_data rld ON TRUE
LEFT JOIN runs_today_data rtd ON TRUE
$$;
