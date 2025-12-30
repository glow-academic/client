-- Get eval_agent context from rubric_grade_agent: active prompt, model, provider, api_key, etc.
-- Parameters: $1=eval_id (uuid), $2=run_id (uuid, nullable), $3=group_id (uuid, nullable), $4=department_id (uuid, nullable), $5=profile_id (uuid, required)
-- Note: Either run_id or group_id must be provided (not both)
-- Returns: agent_id, agent_name, system_prompt, model_id, model_name, provider, base_url, api_key, temperature, reasoning, profile_id, req_per_day, runs_today_count, earliest_run_created_at
WITH params AS (
    SELECT 
        $1::uuid as eval_id,
        $2::uuid as run_id,
        $3::uuid as group_id,
        $4::uuid as department_id,
        $5::uuid as profile_id
),
-- Get rubric_grade_agent_id from appropriate junction table
rubric_grade_agent_from_run_or_group AS (
    SELECT rga.grade_text_agent_id as eval_agent_id
    FROM params p
    LEFT JOIN eval_runs_rubric_grade_agents errga ON errga.eval_id = p.eval_id AND errga.run_id = p.run_id AND p.run_id IS NOT NULL
    LEFT JOIN eval_groups_rubric_grade_agents egga ON egga.eval_id = p.eval_id AND egga.group_id = p.group_id AND p.group_id IS NOT NULL
    JOIN rubric_grade_agents rga ON rga.id = COALESCE(errga.rubric_grade_agent_id, egga.rubric_grade_agent_id)
    WHERE (p.run_id IS NOT NULL OR p.group_id IS NOT NULL)
    ORDER BY COALESCE(errga.created_at, egga.created_at)
    LIMIT 1
),
eval_agent_from_rubric_grade_agent AS (
    SELECT eval_agent_id FROM rubric_grade_agent_from_run_or_group
),
profile_rate_limit AS (
    SELECT prl.requests_per_day as req_per_day
    FROM profiles prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    WHERE prof.id = (SELECT profile_id FROM params)
),
runs_today AS (
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM params)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
-- Use profile's primary department for settings resolution
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_departments pd
    CROSS JOIN params p
    WHERE pd.profile_id = p.profile_id
      AND pd.is_primary = TRUE 
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
),
context_data AS (
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
        COALESCE(p_prov.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        
        -- Profile data
        p.profile_id::text as profile_id,
        
        -- Rate limit data
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at
        
    FROM params p
    CROSS JOIN eval_agent_from_rubric_grade_agent earga
    INNER JOIN agents a ON a.id = earga.eval_agent_id AND a.active = true
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id 
        AND adp_prompt.department_id = p.department_id 
        AND adp_prompt.active = true
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
    LEFT JOIN providers p_prov ON p_prov.id = m.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
)
SELECT 
    cd.agent_id,
    cd.agent_name,
    cd.system_prompt,
    cd.model_id,
    cd.model_name,
    cd.provider,
    cd.base_url,
    cd.api_key,
    cd.temperature,
    cd.reasoning,
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at
FROM context_data cd

