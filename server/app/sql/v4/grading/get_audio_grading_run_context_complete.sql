-- Get all data needed to run audio grading agent
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_audio_grading_run_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_audio_grading_run_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_audio_grading_run_context_v4(
    agent_id uuid,
    department_id uuid
)
RETURNS TABLE (
    agent_id text,
    agent_name text,
    system_prompt text,
    temperature float,
    reasoning text,
    model_id text,
    model_name text,
    provider text,
    base_url text,
    api_key text,
    custom_model text,
    provider_id text,
    provider_name text,
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        agent_id AS agent_id,
        department_id AS department_id
),
profile_from_department AS (
    -- Get a profile from the department (for rate limiting and settings)
    SELECT pd.profile_id
    FROM profile_departments pd
    WHERE pd.department_id = (SELECT department_id FROM params)
      AND pd.active = true
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = (SELECT profile_id FROM profile_from_department)
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM profile_from_department)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_from_department pfd
    JOIN profile_departments pd ON pd.profile_id = pfd.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
default_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND s.active = true 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND k.active = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND s.active = true AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
active_settings AS (
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
)
SELECT 
    -- Agent data
    a.id::text as agent_id,
    a.name as agent_name,
    COALESCE(pr_prompt.system_prompt, '') as system_prompt,
    COALESCE(mtl.temperature, 0.0) as temperature,
    mrl.reasoning_level as reasoning,
    
    -- Model data
    m.id::text as model_id,
    m.value as model_name,
    COALESCE(p.value::text, '') as provider,
    COALESCE(me.base_url, '') as base_url,
    k.key as api_key,
    
    -- Custom model (if any) - indicated by presence of base_url in model_endpoints
    CASE WHEN me.base_url IS NOT NULL AND me.base_url != '' THEN m.value ELSE NULL END as custom_model,
    
    -- Provider data
    NULL::text as provider_id,
    COALESCE(p.value::text, '') as provider_name,
    
    -- Profile data
    (SELECT profile_id::text FROM profile_from_department) as profile_id,
    
    -- Rate limit data
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at

FROM params p_params
CROSS JOIN profile_from_department pfd
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt
JOIN agents a ON a.id = p_params.agent_id
-- Try department-specific prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = p_params.department_id AND adp_prompt.active = true
LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
-- Use department-specific prompt if available, otherwise use default
LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
INNER JOIN models m ON m.id = a.model_id
-- Join temperature from junction table
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
-- Join reasoning from junction table
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
-- Get keys via settings system: provider -> active settings -> setting_provider_keys
LEFT JOIN providers p ON p.id = m.provider_id
CROSS JOIN active_settings act_s
LEFT JOIN setting_provider_keys spk ON spk.provider_id = p.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
WHERE a.active = true
$$;

COMMIT;

