-- Get all data needed to run video agent with optimized JOIN
-- Parameters: $1=video_id (uuid), $2=profile_id (uuid, nullable)
-- Returns: agent, model, provider, and profile data
-- Gets department_id from video's first department link
WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT $1::uuid as video_id, $2::uuid as profile_id
),
video_department AS (
    -- Get first department_id from video_departments, or NULL if video has no department links (cross-department)
    SELECT 
        vd.department_id,
        v.id as video_id
    FROM params p
    JOIN videos v ON v.id = p.video_id
    LEFT JOIN video_departments vd ON vd.video_id = v.id AND vd.active = true
    ORDER BY vd.created_at
    LIMIT 1
),
default_guest AS (
    -- Get default guest profile from settings system
    SELECT sdg.profile_id::text as guest_profile_id
    FROM settings_default_guest sdg
    JOIN settings s ON s.id = sdg.settings_id AND s.active = true
    WHERE sdg.active = true
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN video_department vd
    WHERE a.role = 'video'
    AND a.active = true
    AND (
        -- Include if agent is linked to the video's department
        (vd.department_id IS NOT NULL AND ad.department_id = vd.department_id)
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
        -- OR video has no department links (cross-department video)
        OR vd.department_id IS NULL
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN vd.department_id IS NOT NULL AND ad.department_id = vd.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile (use provided profile_id or default guest)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    WHERE prof.id = COALESCE(
        (SELECT profile_id FROM params WHERE profile_id IS NOT NULL),
        (SELECT guest_profile_id::uuid FROM default_guest)
    )
),
runs_today AS (
    -- Count model runs for the profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = COALESCE(
        (SELECT profile_id FROM params WHERE profile_id IS NOT NULL),
        (SELECT guest_profile_id::uuid FROM default_guest)
    )
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
resolved_profile_for_settings AS (
    SELECT COALESCE(
        (SELECT profile_id FROM params WHERE profile_id IS NOT NULL),
        (SELECT guest_profile_id::uuid FROM default_guest)
    ) as profile_id
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
profile_primary_department AS (
    SELECT pd.department_id
    FROM resolved_profile_for_settings rpfs
    JOIN profile_departments pd ON pd.profile_id = rpfs.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE s.active = true 
      AND sd.active = true
    LIMIT 1
),
active_settings AS (
    SELECT 
        COALESCE(
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
    
    -- Provider data (provider enum is now on models table, no separate providers table)
    NULL::text as provider_id,
    COALESCE(p.value::text, '') as provider_name,
    
    -- Profile data (use provided profile_id or default guest)
    COALESCE(
        (SELECT profile_id::text FROM params WHERE profile_id IS NOT NULL),
        dg.guest_profile_id
    ) as profile_id,
    
    -- Default guest profile
    dg.guest_profile_id as default_guest_profile_id,
    
    -- Rate limit data
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at

FROM best_agent ba
INNER JOIN agents a ON a.id = ba.agent_id
CROSS JOIN params p
CROSS JOIN video_department vd
-- Try department-specific prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = vd.department_id AND adp_prompt.active = true
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
-- IMPORTANT: Only join reasoning levels that belong to the agent's model (m.id = mrl.model_id)
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
CROSS JOIN default_guest dg
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt

