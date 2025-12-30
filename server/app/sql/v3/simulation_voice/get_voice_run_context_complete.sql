-- Get all data needed to run simulation voice agent
-- Parameters: $1=chat_id (uuid), $2=run_id (uuid - already exists from member_progress)
-- Returns: chat, attempt, scenario, persona, model, provider, simulation settings, profile, and documents data
-- Run already exists from member_progress, so we just get context
-- Based on get_simulation_run_context.sql but takes run_id as parameter and focuses on voice fields
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
    sc.id as chat_id,
    sc.title as chat_title,
    sc.created_at,
    sc.trace_id,
    -- Attempt data
    sa.id as attempt_id,
    sa.simulation_id,
    -- Scenario data
    s.id as scenario_id,
    s.problem_statement,
    (SELECT department_id FROM resolved_dept) as department_id,
    -- Persona data (text fields - kept for compatibility)
    p.id as persona_id,
    p.name as persona_name,
    p.system_prompt,
    p.temperature,
    p.reasoning,
    -- Voice persona fields (preferred for voice mode)
    p.voice_system_prompt,
    p.voice_temperature,
    p.voice_reasoning,
    -- Model data (text fields - kept for compatibility)
    m.id as model_id,
    m.name as model_name,
    m.custom_model,
    -- Voice model fields (preferred for voice mode)
    vm.id as voice_model_id,
    vm.name as voice_model_name,
    vm.custom_model as voice_custom_model,
    -- Provider data (text fields - kept for compatibility)
    pr.id as provider_id,
    pr.name as provider_name,
    pr.base_url,
    -- Voice provider fields (preferred for voice mode)
    vpr.id as voice_provider_id,
    vpr.name as voice_provider,
    vpr.base_url as voice_base_url,
    -- Settings data (for API keys)
    st.id as settings_id,
    -- API keys (text - kept for compatibility)
    (SELECT k.value FROM keys k 
     JOIN setting_provider_keys spk ON spk.key_id = k.id 
     WHERE spk.settings_id = st.id 
       AND spk.provider_id = pr.id 
       AND spk.active = true 
       AND k.active = true 
     LIMIT 1) as api_key,
    -- Voice API keys (preferred for voice mode)
    (SELECT k.value FROM keys k 
     JOIN setting_provider_keys spk ON spk.key_id = k.id 
     WHERE spk.settings_id = st.id 
       AND spk.provider_id = vpr.id 
       AND spk.active = true 
       AND k.active = true 
     LIMIT 1) as voice_api_key,
    -- Profile data
    pf.profile_id,
    -- Agent data (text - kept for compatibility)
    sim.simulation_text_agent_id as agent_id,
    -- Voice agent data (preferred for voice mode)
    sim.simulation_voice_agent_id as voice_agent_id,
    -- Documents data
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'id', d.id::text,
                'name', d.name,
                'url', d.url,
                'type', d.type,
                'created_at', d.created_at
            )
        )
        FROM documents d
        JOIN scenario_documents sd ON sd.document_id = d.id
        WHERE sd.scenario_id = s.id AND sd.active = true AND d.active = true),
        '[]'::json
    ) as documents
FROM params p
JOIN chats sc ON sc.id = p.chat_id
JOIN attempt_chats ac ON ac.chat_id = sc.id
INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
INNER JOIN scenarios s ON s.id = sc.scenario_id
INNER JOIN simulations sim ON sim.id = sa.simulation_id
LEFT JOIN personas p ON p.id = sc.persona_id AND p.active = true
LEFT JOIN models m ON m.id = p.model_id AND m.active = true
LEFT JOIN models vm ON vm.id = p.voice_model_id AND vm.active = true
LEFT JOIN providers pr ON pr.id = m.provider_id AND pr.active = true
LEFT JOIN providers vpr ON vpr.id = vm.provider_id AND vpr.active = true
LEFT JOIN active_settings ast ON true
LEFT JOIN settings st ON st.id = ast.settings_id
LEFT JOIN profile_from_attempt pf ON true
WHERE sc.id = p.chat_id

