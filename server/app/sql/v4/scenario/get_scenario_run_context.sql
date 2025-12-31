-- Get all data needed to run scenario agent with optimized JOIN
-- Parameters: $1=department_id (uuid), $2=persona_id (uuid, nullable), $3=document_ids[] (uuid array), $4=parameter_item_ids[] (uuid array), $5=agent_id (uuid, required), $6=profile_id (uuid, required)
-- Returns: agent, model, provider, persona, documents, parameter items
-- Uses the provided agent_id directly (UI handles filtering and selection)
WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT 
        $1::uuid as department_id, 
        $2::uuid as persona_id, 
        $3::uuid[] as document_ids, 
        $4::uuid[] as parameter_item_ids,
        $5::uuid as agent_id,
        $6::uuid as profile_id
),
best_agent AS (
    -- Use the provided agent_id directly (UI handles filtering and selection)
    SELECT a.id as agent_id
    FROM agents a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
    AND a.active = true
),
profile_rate_limit AS (
    -- Get rate limit for the profile
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    WHERE prof.id = (SELECT profile_id FROM params)
),
runs_today AS (
    -- Count model runs for the profile since start of day
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
    -- Get settings with no department links (cross-department/default)
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
    -- Agent data (via department_agents junction for 'scenario' role)
    a.id::text as agent_id,
    a.name as agent_name,
    a.role::text as agent_role,
    COALESCE(pr_prompt.system_prompt, '') as system_prompt,
    COALESCE(mtl.temperature, 0.0) as temperature,
    mrl.reasoning_level as reasoning,
    
    -- Model data
    m.id::text as model_id,
    m.value as model_name,
    COALESCE(p_prov.value::text, '') as provider,
    COALESCE(me.base_url, '') as base_url,
    k.key as api_key,
    -- Custom model (if any) - indicated by presence of base_url in model_endpoints
    CASE WHEN me.base_url IS NOT NULL AND me.base_url != '' THEN m.value ELSE NULL END as custom_model,
    -- Provider data (provider enum is now on models table, no separate providers table)
    NULL::text as provider_id,
    COALESCE(p_prov.value::text, '') as provider_name,
    
    -- Persona data (nullable)
    pers.id::text as persona_id,
    pers.name as persona_name,
    pers.description as persona_description,
    
    -- Documents data (aggregated as JSON array)
    -- Includes template file paths for template documents (COALESCE pattern)
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'id', d.id::text,
                'name', d.name,
                'file_path', COALESCE(u.file_path, template_u.file_path),
                'mime_type', COALESCE(u.mime_type, template_u.mime_type),
                'template', d.template,
                'template_args', t.args
            )
            ORDER BY array_position(p.document_ids, d.id)
        )
        FROM documents d
        LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
        LEFT JOIN uploads u ON u.id = du.upload_id
        LEFT JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
        LEFT JOIN templates t ON t.id = dt.template_id
        LEFT JOIN uploads template_u ON template_u.id = t.upload_id
        WHERE d.id = ANY(p.document_ids)
        ),
        '[]'::json
    ) as documents,
    
    -- Document templates data (aggregated as JSON array for template documents)
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'document_id', d.id::text,
                'document_name', d.name,
                'template_args', t.args,
                'template_upload_id', t.upload_id::text
            )
            ORDER BY array_position(p.document_ids, d.id)
        )
        FROM documents d
        INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
        INNER JOIN templates t ON t.id = dt.template_id
        WHERE d.id = ANY(p.document_ids)
          AND d.template = true
        ),
        '[]'::json
    ) as document_templates,
    
    -- Parameter items data (aggregated as JSON array with parameter info)
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'item_name', f.name,
                'item_description', f.description,
                'param_name', pa.name,
                'param_description', pa.description
            )
            ORDER BY array_position(p.parameter_item_ids, f.id)
        )
        FROM fields f
        JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
        JOIN parameters pa ON pa.id = fp.parameter_id
        WHERE f.id = ANY(p.parameter_item_ids)
        ),
        '[]'::json
    ) as parameter_items,
    
    -- Rate limit data (for profile)
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at

FROM best_agent ba
INNER JOIN agents a ON a.id = ba.agent_id
CROSS JOIN params p
-- Try department-specific prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = p.department_id AND adp_prompt.active = true
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
LEFT JOIN providers p_prov ON p_prov.id = m.provider_id
CROSS JOIN active_settings act_s
LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    LEFT JOIN personas pers ON pers.id = p.persona_id
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
