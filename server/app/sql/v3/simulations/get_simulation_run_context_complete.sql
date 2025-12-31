-- Get all data needed to run simulation agent with optimized JOIN
-- Converted to PostgreSQL function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_simulation_run_context_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_simulation_run_context_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_simulation_run_context_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for composite structures
CREATE TYPE types.q_get_simulation_run_context_v3_document AS (
    id text,
    name text,
    file_path text,
    mime_type text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_get_simulation_run_context_v3(
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
    agent_id text,
    voice_system_prompt text,
    voice_temperature float,
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
    documents types.q_get_simulation_run_context_v3_document[]
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT chat_id
),
scenario_dept AS (
    SELECT 
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    CROSS JOIN params p
    WHERE sc.id = p.chat_id
),
profile_dept AS (
    -- Get first department from profile's accessible departments
    SELECT d.id as department_id
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    JOIN attempt_profiles ap ON ap.profile_id = pd.profile_id
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id
    CROSS JOIN params p
    WHERE ac.chat_id = p.chat_id 
      AND ap.active = true 
      AND d.active = true
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
profile_rate_limit AS (
    -- Get rate limit for the profile (via attempt_profiles)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    CROSS JOIN params p
    WHERE prof.id = (SELECT ap.profile_id FROM attempt_profiles ap 
                  JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
                  WHERE ac.chat_id = p.chat_id AND ap.active = true LIMIT 1)
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    CROSS JOIN params p
    WHERE mrp.profile_id = (SELECT ap.profile_id FROM attempt_profiles ap 
                            JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
                            WHERE ac.chat_id = p.chat_id AND ap.active = true LIMIT 1)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
profile_from_attempt AS (
    -- Get profile_id from attempt_profiles for settings resolution
    SELECT ap.profile_id
    FROM attempt_profiles ap 
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
    CROSS JOIN params p
    WHERE ac.chat_id = p.chat_id AND ap.active = true
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
    -- Only use department-specific/default settings if they have keys, otherwise prefer any settings with keys
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),  -- Any with keys
            (SELECT settings_id FROM dept_specific_settings),  -- Original fallback (no keys available)
            (SELECT settings_id FROM default_settings),  -- Original fallback (no keys available)
            (SELECT id FROM settings WHERE active = true LIMIT 1)  -- Last resort
        ) as settings_id
),
-- Document data for composite type aggregation
document_data AS (
    SELECT 
        sc.id::text as chat_id,
        d.id as document_id,
        d.name,
        u.file_path,
        u.mime_type
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id AND sd.active = true
    LEFT JOIN documents d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    CROSS JOIN params p
    WHERE sc.id = p.chat_id
),
context_data AS (
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
        
        -- Text agent/model data (backward compatibility - existing fields)
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
        
        -- Voice agent/model data (prefixed with voice_*)
        COALESCE(
            COALESCE(pr_prompt_voice_dept.system_prompt, pr_prompt_voice_default.system_prompt),
            ''
        ) as voice_system_prompt,
        COALESCE(mtl_voice.temperature, 0.0) as voice_temperature,
        mrl_voice.reasoning_level as voice_reasoning,
        m_voice.id::text as voice_model_id,
        m_voice.value as voice_model_name,
        COALESCE(p_voice.value::text, '') as voice_provider,
        COALESCE(me_voice.base_url, '') as voice_base_url,
        k_voice.key as voice_api_key,
        CASE WHEN me_voice.base_url IS NOT NULL AND me_voice.base_url != '' THEN m_voice.value ELSE NULL END as voice_custom_model,
        COALESCE(p_voice.value::text, '') as voice_provider_name,
        a_voice.id::text as voice_agent_id,
        
        -- Scenario settings (flags moved from scenarios to simulation_scenarios)
        COALESCE(s.images_enabled, false) as image_input_enabled,
        COALESCE(ss.copy_paste_allowed, false) as copy_paste_allowed,
        
        -- Profile data (via attempt_profiles junction)
        ap.profile_id::text as profile_id,
        
        -- Rate limit data
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at

    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = sa.simulation_id AND ss.scenario_id = s.id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    INNER JOIN simulations sim ON sim.id = sa.simulation_id
    -- Get trace_id from groups via chat_groups
    LEFT JOIN chat_groups cg ON cg.chat_id = sc.id
    LEFT JOIN groups g ON g.id = cg.group_id
    -- Get first persona for orchestrator (ensures single row for orchestrator config)
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

    -- Text agent joins (use simulation agent instead of persona agent)
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
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN providers p_prov ON p_prov.id = m.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true

    -- Voice agent joins (use simulation agent instead of persona agent)
    LEFT JOIN agents a_voice ON a_voice.id = sim.simulation_voice_agent_id AND a_voice.active = true
    LEFT JOIN models m_voice ON m_voice.id = a_voice.model_id
    LEFT JOIN agent_temperature_levels atl_voice ON atl_voice.agent_id = a_voice.id AND atl_voice.active = true
    LEFT JOIN model_temperature_levels mtl_voice ON mtl_voice.id = atl_voice.model_temperature_level_id AND mtl_voice.active = true AND mtl_voice.model_id = m_voice.id
    LEFT JOIN agent_reasoning_levels arl_voice ON arl_voice.agent_id = a_voice.id AND arl_voice.active = true
    LEFT JOIN model_reasoning_levels mrl_voice ON mrl_voice.id = arl_voice.model_reasoning_level_id AND mrl_voice.active = true AND mrl_voice.model_id = m_voice.id
    LEFT JOIN agent_department_prompts adp_prompt_voice ON adp_prompt_voice.agent_id = a_voice.id 
        AND adp_prompt_voice.department_id = (SELECT department_id FROM resolved_dept)
        AND adp_prompt_voice.active = true
    LEFT JOIN prompts pr_prompt_voice_dept ON pr_prompt_voice_dept.id = adp_prompt_voice.prompt_id
    LEFT JOIN agent_prompts ap_voice_default ON ap_voice_default.agent_id = a_voice.id AND ap_voice_default.active = true
    LEFT JOIN prompts pr_prompt_voice_default ON pr_prompt_voice_default.id = ap_voice_default.prompt_id
    LEFT JOIN model_endpoints me_voice ON me_voice.model_id = m_voice.id AND me_voice.active = true
    -- Get voice keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN providers p_voice ON p_voice.id = m_voice.provider_id
    CROSS JOIN active_settings act_s_voice
    LEFT JOIN setting_provider_keys spk_voice ON spk_voice.provider_id = p_voice.id 
        AND spk_voice.settings_id = act_s_voice.settings_id 
        AND spk_voice.active = true
    LEFT JOIN keys k_voice ON k_voice.id = spk_voice.key_id AND k_voice.active = true
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    CROSS JOIN resolved_dept
    CROSS JOIN params p_params
    WHERE sc.id = p_params.chat_id
    GROUP BY sc.id, sc.title, g.trace_id,
             sa.id, sa.simulation_id,
             s.id, ps.problem_statement,
             first_persona.persona_id, first_persona.persona_name,
             p.id, p.name, 
             -- Text agent fields
             pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt, COALESCE(mtl.temperature, 0.0), mrl.reasoning_level,
             m.id, m.value, p_prov.value, k.key, me.base_url, a.id, act_s.settings_id,
             -- Voice agent fields
             pr_prompt_voice_dept.system_prompt, pr_prompt_voice_default.system_prompt, COALESCE(mtl_voice.temperature, 0.0), mrl_voice.reasoning_level,
             m_voice.id, m_voice.value, p_voice.value, k_voice.key, me_voice.base_url, a_voice.id, act_s_voice.settings_id,
             -- Other fields
             s.images_enabled, ss.copy_paste_allowed,
             ap.profile_id,
             prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at
)
SELECT 
    cd.*,
    -- Aggregate documents as composite type array
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.document_id::text, dd.name, dd.file_path, dd.mime_type)::types.q_get_simulation_run_context_v3_document
            ORDER BY dd.document_id
        ) FROM document_data dd WHERE dd.chat_id::text = cd.chat_id),
        '{}'::types.q_get_simulation_run_context_v3_document[]
    ) as documents
FROM context_data cd
$$;

COMMIT;

