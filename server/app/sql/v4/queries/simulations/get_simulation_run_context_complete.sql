-- Get all data needed to run simulation agent with optimized JOIN
-- Converted to PostgreSQL function
-- Returns: chat, attempt, scenario, persona, model, provider, simulation settings, profile, and documents data
-- Returns both text and voice agent/model fields for flexibility
-- Existing fields (persona_id, model_id, etc.) point to text agent/model
-- Voice fields are prefixed with voice_* (voice_model_id, voice_model_name, etc.)
-- Note: Uses JSON for documents aggregation - may need refactoring per STANDARDS.md
--
-- Updated for migration 331: Uses the new entry→resource connection tables
-- - Unified all_chats, all_attempts, all_attempt_simulations, all_attempt_profiles CTEs
-- - Chat→scenario via all_chat_scenarios connection
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_simulation_run_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_run_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_run_context_v4(
    chat_id uuid
)
RETURNS TABLE (
    chat_id text,
    chat_title text,
    trace_id text,
    attempt_id text,
    simulation_id text,
    scenario_id text,
    department_id text,
    problem_statement text,
    persona_id text,
    persona_name text,
    system_prompt text,
    temperature double precision,
    reasoning text,
    model_id text,
    model_name text,
    provider text,
    base_url text,
    api_key text,
    custom_model text,
    provider_id text,
    provider_name text,
    agent_id text,
    voice_system_prompt text,
    voice_temperature double precision,
    voice_reasoning text,
    voice_model_id text,
    voice_model_name text,
    voice_provider text,
    voice_base_url text,
    voice_api_key text,
    voice_custom_model text,
    voice_provider_name text,
    voice_agent_id text,
    image_input_enabled boolean,
    copy_paste_allowed boolean,
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    documents json
)
LANGUAGE sql
STABLE
AS $$
WITH
-- Unified chats (general + practice)
all_chats AS (
    SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active
    FROM simulation_chats_entry
),
-- Unified attempts (general + practice)
all_attempts AS (
    SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active
    FROM simulation_attempts_entry
),
-- Unified chat→scenario connections
all_chat_scenarios AS (
    SELECT chat_id, scenarios_id, created_at
    FROM simulation_chats_scenarios_connection
),
-- Unified attempt→simulation connections
all_attempt_simulations AS (
    SELECT attempt_id, simulations_id
    FROM simulation_attempts_simulations_connection
),
-- Unified attempt→profile connections
all_attempt_profiles AS (
    SELECT attempt_id, profiles_id
    FROM simulation_attempts_profiles_connection
),
scenario_dept AS (
    SELECT
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments_junction sd
         WHERE sd.scenario_id = ssj_dept.scenario_id AND sd.active = true LIMIT 1) as department_id
    FROM all_chats sc
    INNER JOIN all_chat_scenarios acs ON acs.chat_id = sc.id
    INNER JOIN scenarios_resource s ON s.id = acs.scenarios_id
    INNER JOIN scenario_scenarios_junction ssj_dept ON ssj_dept.scenarios_id = s.id
    WHERE sc.id = chat_id
),
profile_dept AS (
    -- Get first department FROM profile_artifact's accessible departments
    SELECT dr.id as department_id
    FROM departments_resource dr
    JOIN department_departments_junction ddj ON ddj.departments_id = dr.id
    JOIN department_artifact d ON d.id = ddj.department_id
    JOIN profile_departments_junction pd ON pd.department_id = dr.id
    JOIN all_chats sc ON sc.id = chat_id
    JOIN all_attempts sa ON sa.id = sc.attempt_id
    JOIN all_attempt_profiles aap ON aap.attempt_id = sa.id
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id AND ppj.profile_id = pd.profile_id
    WHERE aap.profiles_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
    LIMIT 1
),
any_active_dept AS (
    -- Get any active department as last resort
    SELECT id as department_id
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
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
profile_rate_limit AS (
    -- Get rate limit for the profile (via attempts_entry)
    SELECT
        rl.requests_per_day as req_per_day
    FROM all_chats sc
    JOIN all_attempts sa ON sa.id = sc.attempt_id
    JOIN all_attempt_profiles aap ON aap.attempt_id = sa.id
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = ppj.profile_id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    WHERE sc.id = chat_id AND aap.profiles_id IS NOT NULL
    LIMIT 1
),
runs_today AS (
    -- Count model runs_entry for this profile since start of day
    SELECT
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs_entry mr
    JOIN profile_runs_junction prj ON prj.run_id = mr.id
    WHERE prj.profile_id = (SELECT ppj.profile_id FROM all_chats sc
                            JOIN all_attempts sa ON sa.id = sc.attempt_id
                            JOIN all_attempt_profiles aap ON aap.attempt_id = sa.id
                            JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id
                            WHERE sc.id = chat_id AND aap.profiles_id IS NOT NULL LIMIT 1)
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
profile_from_attempt AS (
    -- Get profile_id (artifact) from attempts_entry for settings resolution
    SELECT ppj.profile_id
    FROM all_chats sc
    JOIN all_attempts sa ON sa.id = sc.attempt_id
    JOIN all_attempt_profiles aap ON aap.attempt_id = sa.id
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id
    WHERE sc.id = chat_id AND aap.profiles_id IS NOT NULL
    LIMIT 1
),
-- Get active settings for profile (for key lookup via setting_provider_keys_junction)
default_settings AS (
    -- Get settings with no department links (cross-department/default)
    SELECT s.id as settings_id
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
profile_primary_department AS (
    -- Get profile's primary department ID
    SELECT pd.department_id
    FROM profile_from_attempt pfa
    JOIN profile_departments_junction pd ON pd.profile_id = pfa.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    -- Get department-specific settings (if primary_department_id exists)
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings_junction sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    -- Settings that have at least one active provider key
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys_junction spk
    JOIN keys_resource kr ON kr.id = spk.key_id
    WHERE spk.active = true AND kr.active
),
dept_specific_settings_with_keys AS (
    -- Department-specific settings that have keys
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings_junction sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    -- Default settings that have keys
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
active_settings AS (
    -- Prefer department-specific with keys, then default with keys, then any with keys, then fallback
    -- Only use department-specific/default settings if they have keys, otherwise prefer any settings with keys
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),  -- Any with keys
            (SELECT settings_id FROM dept_specific_settings),  -- Original fallback (no keys available)
            (SELECT settings_id FROM default_settings),  -- Original fallback (no keys available)
            (SELECT id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE) LIMIT 1)  -- Last resort
        ) as settings_id
)
SELECT 
    -- Chat data
    sc.id::text as chat_id,
    sc.title as chat_title,
    (SELECT g.trace_id FROM messages_entry m_t JOIN runs_entry r_t ON r_t.id = m_t.run_id JOIN groups_entry g ON g.id = r_t.group_id WHERE m_t.chat_id = sc.id LIMIT 1) as trace_id,
    
    -- Attempt data
    sa.id::text as attempt_id,
    sim_ssj.simulation_id::text,
    
    -- Scenario data
    s.id::text as scenario_id,
    (SELECT department_id::text FROM resolved_dept) as department_id,
    ps.problem_statement,
    
    -- Persona data (via scenario_personas_junction junction - first persona for orchestrator)
    first_persona.persona_id::text as persona_id,
    first_persona.persona_name as persona_name,
    
    -- Text agent/model data (backward compatibility - existing fields)
    COALESCE(pr_prompt_default.system_prompt, '') as system_prompt,
    COALESCE(tl.temperature, 0.0) as temperature,
    rl.reasoning_level as reasoning,
    m.id::text as model_id,
    (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
    COALESCE(n_prov.name, '') as provider,
    COALESCE(e.base_url, '') as base_url,
    kr.key as api_key,
    CASE WHEN e.base_url IS NOT NULL AND e.base_url != '' THEN (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) ELSE NULL END as custom_model,
    NULL::text as provider_id,
    COALESCE(n_prov.name, '') as provider_name,
    a.id::text as agent_id,
    
    -- Voice agent/model data (prefixed with voice_*)
    COALESCE(pr_prompt_voice_default.system_prompt, '') as voice_system_prompt,
    COALESCE(tl_voice.temperature, 0.0) as voice_temperature,
    rl_voice.reasoning_level as voice_reasoning,
    m_voice.id::text as voice_model_id,
    m_voice.value as voice_model_name,
    COALESCE(n_voice_prov.name, '') as voice_provider,
    COALESCE(e_voice.base_url, '') as voice_base_url,
    kr_voice.key as voice_api_key,
    CASE WHEN e_voice.base_url IS NOT NULL AND e_voice.base_url != '' THEN m_voice.value ELSE NULL END as voice_custom_model,
    COALESCE(n_voice_prov.name, '') as voice_provider_name,
    a_voice.id::text as voice_agent_id,
    
    -- Scenario settings (flags moved FROM scenario_artifact to simulation_scenarios_junction)
        COALESCE(EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'images_enabled' AND sf.value = TRUE), false) as image_input_enabled,
    COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
        AND sfr.scenario_id = ss.scenario_id
        AND f.name = 'copy_paste_allowed'), false) as copy_paste_allowed,

    -- Profile data (via attempts_entry)
    aap_main.profiles_id::text as profile_id,
    
    -- Rate limit data
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at,
    
    -- Documents data (aggregated as JSON array with full document info)
    COALESCE(
        json_agg(
            json_build_object(
                'id', doc.id::text,
                'name', (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = doc.id LIMIT 1),
                'file_path', u.file_path,
                'mime_type', u.mime_type
            )
            ORDER BY doc.id
        ) FILTER (WHERE doc.id IS NOT NULL AND sd.active = true),
        '[]'::json
    ) as documents

FROM all_chats sc
INNER JOIN all_chat_scenarios acs_main ON acs_main.chat_id = sc.id
INNER JOIN all_attempts sa ON sa.id = sc.attempt_id
INNER JOIN all_attempt_simulations aas_main ON aas_main.attempt_id = sa.id
INNER JOIN simulation_simulations_junction sim_ssj ON sim_ssj.simulations_id = aas_main.simulations_id
LEFT JOIN all_attempt_profiles aap_main ON aap_main.attempt_id = sa.id
INNER JOIN scenarios_resource s ON s.id = acs_main.scenarios_id
INNER JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = s.id
LEFT JOIN simulation_scenarios_junction ss ON ss.simulation_id = sim_ssj.simulation_id AND ss.scenario_id = ssj.scenario_id
LEFT JOIN scenario_problem_statements_junction sps ON sps.scenario_id = ssj.scenario_id AND sps.active = true
LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
INNER JOIN simulation_artifact sim ON sim.id = sim_ssj.simulation_id
-- Get first persona for orchestrator (ensures single row for orchestrator config)
LEFT JOIN (
    SELECT DISTINCT ON (sp.scenario_id) 
        sp.scenario_id,
        sp.persona_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = sp.persona_id LIMIT 1) as persona_name
    FROM scenario_personas_junction sp
        WHERE sp.active = true AND EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = sp.persona_id AND f.name = 'persona_active' AND pf.value = true)
    ORDER BY sp.scenario_id, (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = sp.persona_id LIMIT 1)
) first_persona ON first_persona.scenario_id = s.id

-- Text agent joins (use simulation agent instead of persona agent)

LEFT JOIN agents_resource a ON a.id = NULL::uuid AND EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
LEFT JOIN agent_models_junction am ON am.agent_id = a.id
LEFT JOIN models_resource m ON m.id = am.model_id
LEFT JOIN agent_temperature_levels_junction atl ON atl.agent_id = a.id AND atl.active = true
LEFT JOIN model_temperature_levels_junction mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = m.id 
LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
LEFT JOIN agent_reasoning_levels_junction arl ON arl.agent_id = a.id AND arl.active = true
LEFT JOIN model_reasoning_levels_junction mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = m.id 
LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true
LEFT JOIN agent_prompts_junction ap_prompt ON ap_prompt.agent_id = a.id AND ap_prompt.active = true
LEFT JOIN prompts_resource pr_prompt_default ON pr_prompt_default.id = ap_prompt.prompt_id
LEFT JOIN model_endpoints_junction me_j ON me_j.model_id = m.id
LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true
-- Get keys via settings system: provider -> active settings -> setting_provider_keys_junction
LEFT JOIN model_providers_junction mp ON mp.model_id = m.id
LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
LEFT JOIN provider_providers_junction ppj ON ppj.providers_id = p_prov.id
LEFT JOIN provider_artifact pr_prov ON pr_prov.id = ppj.provider_id
LEFT JOIN provider_names_junction pn_prov ON pn_prov.provider_id = pr_prov.id
LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
CROSS JOIN active_settings act_s
LEFT JOIN setting_provider_keys_junction spk ON spk.providers_id = p_prov.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
LEFT JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active

-- Voice agent joins (use simulation agent instead of persona agent)

LEFT JOIN agents_resource a_voice ON a_voice.id = NULL::uuid AND EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a_voice.id AND f.name = 'agent_active' AND af.value = TRUE)
LEFT JOIN agent_models_junction am_voice ON am_voice.agent_id = a_voice.id
LEFT JOIN models_resource m_voice ON m_voice.id = am_voice.model_id
LEFT JOIN agent_temperature_levels_junction atl_voice ON atl_voice.agent_id = a_voice.id AND atl_voice.active = true
LEFT JOIN model_temperature_levels_junction mtl_voice ON mtl_voice.temperature_level_id = atl_voice.temperature_level_id AND mtl_voice.model_id = m_voice.id
LEFT JOIN temperature_levels_resource tl_voice ON tl_voice.id = mtl_voice.temperature_level_id AND tl_voice.active = true
LEFT JOIN agent_reasoning_levels_junction arl_voice ON arl_voice.agent_id = a_voice.id AND arl_voice.active = true
LEFT JOIN model_reasoning_levels_junction mrl_voice ON mrl_voice.reasoning_level_id = arl_voice.reasoning_level_id AND mrl_voice.model_id = m_voice.id
LEFT JOIN reasoning_levels_resource rl_voice ON rl_voice.id = mrl_voice.reasoning_level_id AND rl_voice.active = true
LEFT JOIN agent_prompts_junction ap_voice ON ap_voice.agent_id = a_voice.id AND ap_voice.active = true
LEFT JOIN prompts_resource pr_prompt_voice_default ON pr_prompt_voice_default.id = ap_voice.prompt_id
LEFT JOIN model_endpoints_junction me_voice_j ON me_voice_j.model_id = m_voice.id
LEFT JOIN endpoints_resource e_voice ON e_voice.id = me_voice_j.endpoint_id AND e_voice.active = true
-- Get voice keys via settings system: provider -> active settings -> setting_provider_keys_junction
LEFT JOIN model_providers_junction mp_voice ON mp_voice.model_id = m_voice.id
LEFT JOIN providers_resource p_voice_prov ON p_voice_prov.id = mp_voice.providers_id
LEFT JOIN provider_providers_junction ppj_voice ON ppj_voice.providers_id = p_voice_prov.id
LEFT JOIN provider_artifact pr_voice_prov ON pr_voice_prov.id = ppj_voice.provider_id
LEFT JOIN provider_names_junction pn_voice_prov ON pn_voice_prov.provider_id = pr_voice_prov.id
LEFT JOIN names_resource n_voice_prov ON n_voice_prov.id = pn_voice_prov.name_id
CROSS JOIN active_settings act_s_voice
LEFT JOIN setting_provider_keys_junction spk_voice ON spk_voice.providers_id = p_voice_prov.id
    AND spk_voice.settings_id = act_s_voice.settings_id
    AND spk_voice.active = true
LEFT JOIN keys_resource kr_voice ON kr_voice.id = spk_voice.key_id AND kr_voice.active
LEFT JOIN scenario_documents_junction sd ON sd.scenario_id = s.id
LEFT JOIN documents_resource doc ON doc.id = sd.document_id
LEFT JOIN document_uploads_resource dur ON dur.document_id = doc.id AND dur.active = true
LEFT JOIN uploads_resource ur ON ur.id = dur.uploads_id
LEFT JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id
LEFT JOIN uploads_entry u ON u.id = uuc.upload_id
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt
CROSS JOIN resolved_dept
WHERE sc.id = chat_id
GROUP BY sc.id, sc.title,
         sa.id, sim_ssj.simulation_id,
         s.id, ps.problem_statement,
         first_persona.persona_id, first_persona.persona_name,
         n_prov.name,
         -- Text agent fields
         pr_prompt_default.system_prompt, COALESCE(tl.temperature, 0.0), rl.reasoning_level,
         m.id, (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1), n_prov.name, kr.key, e.base_url, a.id, act_s.settings_id,
         -- Voice agent fields
         pr_prompt_voice_default.system_prompt, COALESCE(tl_voice.temperature, 0.0), rl_voice.reasoning_level,
         m_voice.id, m_voice.value, n_voice_prov.name, kr_voice.key, e_voice.base_url, a_voice.id, act_s_voice.settings_id,
         -- Other fields
         EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'images_enabled' AND sf.value = TRUE), 
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'copy_paste_allowed'), false),
         aap_main.profiles_id,
         prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at
$$;
