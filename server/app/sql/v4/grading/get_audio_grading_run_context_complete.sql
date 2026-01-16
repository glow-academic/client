-- Get all data needed to run audio grading agent
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
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
        rl.requests_per_day as req_per_day
    FROM profile_from_department pfd
    LEFT JOIN profile_request_limits prl ON prl.profile_id = pfd.profile_id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
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
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys_resource kr ON kr.id = spk.key_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags_resource f ON kf.flag_id = f.id WHERE kf.key_id = kr.id AND f.name = 'active' AND kf.value = TRUE) = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true)
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
            (SELECT s.id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true) LIMIT 1)
        ) as settings_id
)
SELECT 
    -- Agent data
    a.id::text as agent_id,
    (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
    COALESCE(pr_prompt.system_prompt, '') as system_prompt,
    COALESCE(tl.temperature, 0.0) as temperature,
    rl.reasoning_level as reasoning,
    
    -- Model data
    m.id::text as model_id,
    (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
    COALESCE(n_prov.name, '') as provider,
    COALESCE(e.base_url, '') as base_url,
    kr.key as api_key,
    
    -- Custom model (if any) - indicated by presence of base_url in model_endpoints
    CASE WHEN e.base_url IS NOT NULL AND e.base_url != '' THEN (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) ELSE NULL END as custom_model,
    
    -- Provider data
    NULL::text as provider_id,
    COALESCE(n_prov.name, '') as provider_name,
    
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
JOIN agents_resource a ON a.id = p_params.agent_id
-- Try department-specific prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = p_params.department_id AND adp_prompt.active = true
LEFT JOIN prompts_resource pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
LEFT JOIN prompts_resource pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
-- Use department-specific prompt if available, otherwise use default
LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
INNER JOIN agent_models am ON am.agent_id = a.id
INNER JOIN models_resource m ON m.id = am.model_id
-- Join temperature from junction table
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = m.id 
LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
-- Join reasoning from junction table
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
LEFT JOIN model_reasoning_levels mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = m.id 
LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true
LEFT JOIN model_endpoints me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true
-- Get keys via settings system: provider -> active settings -> setting_provider_keys
LEFT JOIN model_providers mp ON mp.model_id = m.id
LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
LEFT JOIN provider_artifact pr_prov ON pr_prov.id = p_prov.provider_id
LEFT JOIN provider_names pn_prov ON pn_prov.provider_id = pr_prov.id
LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
CROSS JOIN active_settings act_s
LEFT JOIN setting_provider_keys spk ON spk.providers_id = p_prov.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
LEFT JOIN keys_resource kr ON kr.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags_resource f ON kf.flag_id = f.id WHERE kf.key_id = kr.id AND f.name = 'active' AND kf.value = TRUE) = true
WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
$$;