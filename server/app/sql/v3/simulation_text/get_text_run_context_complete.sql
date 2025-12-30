-- Get all data needed to run simulation text agent
-- Parameters: $1=chat_id (uuid), $2=run_id (uuid - already exists from member_progress)
-- Returns: chat, attempt, scenario, persona, model, provider, simulation settings, profile, and documents data
-- Run already exists from member_progress, so we just get context
-- Based on get_simulation_run_context.sql but takes run_id as parameter
WITH params AS (
    SELECT $1::uuid as chat_id, $2::uuid as run_id
),
scenario_dept AS (
    SELECT 
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
    FROM params p
    JOIN chats sc ON sc.id = p.chat_id
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
),
profile_dept AS (
    -- Get first department from profile's accessible departments
    SELECT d.id as department_id
    FROM params p
    JOIN departments d ON d.active = true
    JOIN profile_departments pd ON pd.department_id = d.id
    JOIN attempt_profiles ap ON ap.profile_id = pd.profile_id
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id
    WHERE ac.chat_id = p.chat_id 
      AND ap.active = true
    LIMIT 1
),
any_active_dept AS (
    -- Get any active department as last resort
    SELECT id as department_id
    FROM departments
    WHERE active = true
    LIMIT 1
),
resolved_dept AS (
    -- Resolve department_id with fallback: scenario -> profile -> any active
    SELECT COALESCE(
        (SELECT department_id FROM scenario_dept),
        (SELECT department_id FROM profile_dept),
        (SELECT department_id FROM any_active_dept)
    ) as department_id
),
profile_from_attempt AS (
    -- Get profile_id from attempt_profiles for settings resolution
    SELECT ap.profile_id
    FROM params p
    JOIN attempt_chats ac ON ac.chat_id = p.chat_id
    JOIN attempt_profiles ap ON ap.attempt_id = ac.attempt_id
    WHERE ap.active = true
    LIMIT 1
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
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
profile_primary_department AS (
    -- Get profile's primary department ID
    SELECT pd.department_id
    FROM profile_from_attempt pfa
    JOIN profile_departments pd ON pd.profile_id = pfa.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    -- Get department-specific settings (if primary_department_id exists)
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE s.active = true 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    -- Settings that have at least one active provider key
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND k.active = true
),
dept_specific_settings_with_keys AS (
    -- Department-specific settings that have keys
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE s.active = true AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    -- Default settings that have keys
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
    -- Prefer department-specific with keys, then default with keys, then any with keys, then fallback
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
    -- Chat data
    sc.id::text as chat_id,
    sc.title as chat_title,
    g.trace_id,
    
    -- Attempt data
    sa.id::text as attempt_id,
    sa.simulation_id::text,
    
    -- Scenario data
    s.id::text as scenario_id,
    (SELECT department_id::text FROM resolved_dept) as department_id,
    ps.problem_statement,
    
    -- Persona data (via scenario_personas junction - first persona for orchestrator)
    p.id::text as persona_id,
    p.name as persona_name,
    
    -- Text agent/model data
    COALESCE(
        COALESCE(pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt),
        ''
    ) as system_prompt,
    COALESCE(mtl.temperature, 0.0) as temperature,
    mrl.reasoning_level as reasoning,
    m.id::text as model_id,
    m.value as model_name,
    COALESCE(p_prov.value::text, '') as provider,
    COALESCE(me.base_url, '') as base_url,
    k.key as api_key,
    CASE WHEN me.base_url IS NOT NULL AND me.base_url != '' THEN m.value ELSE NULL END as custom_model,
    NULL::text as provider_id,
    COALESCE(p_prov.value::text, '') as provider_name,
    a.id::text as agent_id,
    
    -- Scenario settings
    COALESCE(s.images_enabled, false) as image_input_enabled,
    COALESCE(ss.copy_paste_allowed, false) as copy_paste_allowed,
    
    -- Profile data (via attempt_profiles junction)
    ap.profile_id::text as profile_id,
    
    -- Documents data (aggregated as JSON array with full document info)
    COALESCE(
        json_agg(
            json_build_object(
                'id', d.id::text,
                'name', d.name,
                'file_path', u.file_path,
                'mime_type', u.mime_type
            )
            ORDER BY d.id
        ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true),
        '[]'::json
    ) as documents,
    
    -- Run ID (already exists from member_progress)
    p.run_id::text as run_id

FROM params p
JOIN chats sc ON sc.id = p.chat_id
JOIN attempt_chats ac ON ac.chat_id = sc.id
INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
INNER JOIN scenarios s ON s.id = sc.scenario_id
LEFT JOIN simulation_scenarios ss ON ss.simulation_id = sa.simulation_id AND ss.scenario_id = s.id
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
INNER JOIN simulations sim ON sim.id = sa.simulation_id
LEFT JOIN groups g ON g.id = (SELECT cg.group_id FROM chat_groups cg WHERE cg.chat_id = sc.id LIMIT 1)
-- Get first persona for orchestrator
LEFT JOIN (
    SELECT DISTINCT ON (sp.scenario_id) 
        sp.scenario_id,
        sp.persona_id,
        p.name as persona_name
    FROM scenario_personas sp
    JOIN personas p ON p.id = sp.persona_id
    WHERE sp.active = true AND p.active = true
    ORDER BY sp.scenario_id, p.name
) first_persona ON first_persona.scenario_id = s.id
LEFT JOIN personas p ON p.id = first_persona.persona_id

-- Text agent joins (use simulation agent)
LEFT JOIN agents a ON a.id = sim.simulation_text_agent_id AND a.active = true
LEFT JOIN models m ON m.id = a.model_id
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id 
    AND adp_prompt.department_id = (SELECT department_id FROM resolved_dept)
    AND adp_prompt.active = true
LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
-- Get keys via settings system
LEFT JOIN providers p_prov ON p_prov.id = m.provider_id
CROSS JOIN active_settings act_s
LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
LEFT JOIN documents d ON d.id = sd.document_id
LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
LEFT JOIN uploads u ON u.id = du.upload_id
WHERE sc.id = (SELECT chat_id FROM params)
GROUP BY sc.id, sc.title, g.trace_id,
         sa.id, sa.simulation_id,
         s.id, ps.problem_statement,
         first_persona.persona_id, first_persona.persona_name,
         p.id, p.name, 
         -- Text agent fields
         pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt, COALESCE(mtl.temperature, 0.0), mrl.reasoning_level,
         m.id, m.value, p_prov.value, k.key, me.base_url, a.id, act_s.settings_id,
         -- Other fields
         s.images_enabled, ss.copy_paste_allowed,
         ap.profile_id,
         p.run_id

