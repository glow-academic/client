-- Get all data needed to run simulation voice regeneration agent AND create run in single atomic transaction
-- Uses existing group_id to get previous context from previous runs
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_voice_regeneration_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_voice_regeneration_run_context_and_create_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_get_voice_regeneration_run_context_and_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for composite structures
CREATE TYPE types.i_get_voice_regeneration_run_context_and_create_run_v4_document AS (
    id text,
    name text,
    url text,
    type text,
    created_at timestamptz
);

CREATE TYPE types.i_get_voice_regeneration_run_context_and_create_run_v4_msg AS (
    role text,
    content text
);

-- 4) Recreate function
-- group_id is REQUIRED (not NULL) for regeneration - uses existing group
-- chat_id is REQUIRED to get simulation context
-- Gets all messages from all previous runs in the group
-- Links existing system/developer messages to the new run
CREATE OR REPLACE FUNCTION socket_get_voice_regeneration_run_context_and_create_run_v4(
    chat_id uuid,
    profile_id uuid,
    group_id uuid,  -- REQUIRED for regeneration (not NULL)
    user_instructions text DEFAULT NULL
)
RETURNS TABLE (
    chat_id uuid,
    chat_title text,
    created_at timestamptz,
    trace_id text,
    attempt_id uuid,
    simulation_id uuid,
    scenario_id uuid,
    problem_statement text,
    department_id uuid,
    persona_id uuid,
    persona_name text,
    system_prompt text,
    temperature float,
    reasoning text,
    voice_system_prompt text,
    voice_temperature float,
    voice_reasoning text,
    model_id uuid,
    model_name text,
    custom_model text,
    voice_model_id uuid,
    voice_model_name text,
    voice_custom_model text,
    provider_id uuid,
    provider_name text,
    base_url text,
    voice_provider_id text,
    voice_provider text,
    voice_base_url text,
    settings_id uuid,
    api_key text,
    voice_api_key text,
    profile_id uuid,
    agent_id uuid,
    voice_agent_id uuid,
    documents types.i_get_voice_regeneration_run_context_and_create_run_v4_document[],
    run_id text,
    previous_messages types.i_get_voice_regeneration_run_context_and_create_run_v4_msg[]
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        chat_id AS chat_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_instructions AS user_instructions
),
group_data AS (
    -- Use existing group (required for regeneration)
    SELECT 
        g.id as group_id,
        g.trace_id
    FROM groups g
    CROSS JOIN params p
    WHERE g.id = p.group_id
),
previous_runs_in_group AS (
    -- Get all previous runs in the group (all runs except the one we're about to create)
    SELECT gr.run_id
    FROM group_runs gr
    CROSS JOIN params p
    WHERE gr.group_id = p.group_id
    ORDER BY gr.idx ASC  -- Order by idx to maintain chronological order
),
previous_messages_all_runs AS (
    -- Get all messages from all previous runs in the group
    -- Ordered chronologically across all runs
    SELECT 
        m.role,
        cnt.content,
        m.created_at,
        gr.idx as run_idx
    FROM previous_runs_in_group prig
    JOIN group_runs gr ON gr.run_id = prig.run_id
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN message m ON m.id = mr.message_id
    LEFT JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN contents cnt ON cnt.id = mc.content_id
    ORDER BY gr.idx ASC, m.created_at ASC  -- Order by run idx first, then message created_at
),
previous_messages_array AS (
    -- Aggregate all previous messages into composite type array
    SELECT COALESCE(
        ARRAY_AGG(
            (role, content)::types.i_get_voice_regeneration_run_context_and_create_run_v4_msg
            ORDER BY run_idx, created_at
        ),
        '{}'::types.i_get_voice_regeneration_run_context_and_create_run_v4_msg[]
    ) as previous_messages
    FROM previous_messages_all_runs
),
scenario_dept AS (
    SELECT 
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
    FROM params p
    JOIN chat sc ON sc.id = p.chat_id
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
),
profile_dept AS (
    -- Get first department from profile's accessible departments
    SELECT d.id as department_id
    FROM params p
    JOIN departments d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
    JOIN profile_departments pd ON pd.department_id = d.id
    JOIN attempt_profiles ap ON ap.profile_id = pd.profile_id
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id
    WHERE ac.chat_id = p.chat_id 
      AND ap.active = true
    LIMIT 1
),
any_active_dept AS (
    -- Get any active department as last resort
    SELECT d.id as department_id
    FROM department d
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
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
    FROM setting s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
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
    FROM setting s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    -- Settings that have at least one active provider key
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
),
dept_specific_settings_with_keys AS (
    -- Department-specific settings that have keys
    SELECT s.id as settings_id
    FROM setting s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    -- Default settings that have keys
    SELECT s.id as settings_id
    FROM setting s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
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
            (SELECT id FROM setting s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
),
profile_rate_limit AS (
    -- Get rate limit for the profile
    SELECT 
        rl.requests_per_day as req_per_day
    FROM profile prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits rl ON prl.request_limit_id = rl.id
    WHERE prof.id = (SELECT profile_id FROM params)
),
runs_today AS (
    -- Count model runs for the profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM run mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM params)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
documents_data AS (
    -- Get documents as composite type array
    SELECT 
        s.id as scenario_id,
        COALESCE(
            ARRAY_AGG(
                (d.id::text, (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), COALESCE(u.file_path, ''), COALESCE(u.mime_type, ''), d.created_at)::types.i_get_voice_regeneration_run_context_and_create_run_v4_document
                ORDER BY d.created_at
            ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true AND EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = true)),
            ARRAY[]::types.i_get_voice_regeneration_run_context_and_create_run_v4_document[]
        ) as documents
    FROM params p
    JOIN chat sc ON sc.id = p.chat_id
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
    LEFT JOIN documents d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    GROUP BY s.id
),
context_data AS (
    -- Get all context data (agent, model, provider, persona, documents, etc.)
    SELECT 
        -- Chat data
        sc.id as chat_id,
        sc.title as chat_title,
        sc.created_at,
        g.trace_id,
        -- Attempt data
        sa.id as attempt_id,
        sa.simulation_id,
        -- Scenario data
        s.id as scenario_id,
        COALESCE(ps.problem_statement, '') as problem_statement,
        (SELECT department_id FROM resolved_dept) as department_id,
        -- Persona data (from scenario_personas)
        (SELECT p_persona.id FROM scenario_personas sp 
         JOIN personas p_persona ON p_persona.id = sp.persona_id 
         WHERE sp.scenario_id = s.id AND sp.active = true 
           AND EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p_persona.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
         LIMIT 1) as persona_id,
        (SELECT (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p_persona.id LIMIT 1) FROM scenario_personas sp 
         JOIN personas p_persona ON p_persona.id = sp.persona_id 
         WHERE sp.scenario_id = s.id AND sp.active = true 
           AND EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p_persona.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
         LIMIT 1) as persona_name,
        -- Voice agent/model data (preferred for voice mode)
        -- Get voice agent from simulation
        adom_voice.agent_id as voice_agent_id,
        -- Get voice model/provider from voice agent
        (SELECT m_voice.id FROM agent a_voice 
         JOIN agent_models am_voice ON am_voice.agent_id = a_voice.id
         JOIN models m_voice ON m_voice.id = am_voice.model_id
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
         LIMIT 1) as voice_model_id,
        (SELECT m_voice.value FROM agent a_voice 
         JOIN agent_models am_voice ON am_voice.agent_id = a_voice.id
         JOIN models m_voice ON m_voice.id = am_voice.model_id
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
         LIMIT 1) as voice_model_name,
        (SELECT CASE WHEN e_voice.base_url IS NOT NULL AND e_voice.base_url != '' THEN m_voice.value ELSE NULL END
         FROM agent a_voice 
         JOIN agent_models am_voice ON am_voice.agent_id = a_voice.id
         JOIN models m_voice ON m_voice.id = am_voice.model_id
         LEFT JOIN model_endpoints me_voice_j ON me_voice_j.model_id = m_voice.id
    LEFT JOIN endpoints e_voice ON e_voice.id = me_voice_j.endpoint_id AND e_voice.active = true
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)) as voice_custom_model,
        (SELECT p_voice_prov.id::text FROM agent a_voice 
         JOIN agent_models am_voice ON am_voice.agent_id = a_voice.id
         JOIN models m_voice ON m_voice.id = am_voice.model_id
         LEFT JOIN model_providers mp_voice ON mp_voice.model_id = m_voice.id
         LEFT JOIN providers p_voice_prov ON p_voice_prov.id = mp_voice.providers_id
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)) as voice_provider_id,
        (SELECT n_voice_prov.name FROM agent a_voice 
         JOIN agent_models am_voice ON am_voice.agent_id = a_voice.id
         JOIN models m_voice ON m_voice.id = am_voice.model_id
         LEFT JOIN model_providers mp_voice ON mp_voice.model_id = m_voice.id
         LEFT JOIN providers p_voice_prov ON p_voice_prov.id = mp_voice.providers_id
         LEFT JOIN provider pr_voice_prov ON pr_voice_prov.id = p_voice_prov.provider_id
         LEFT JOIN provider_names pn_voice_prov ON pn_voice_prov.provider_id = pr_voice_prov.id
         LEFT JOIN names n_voice_prov ON n_voice_prov.id = pn_voice_prov.name_id
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)) as voice_provider,
        (SELECT e_voice.base_url FROM agent a_voice 
         JOIN agent_models am_voice ON am_voice.agent_id = a_voice.id
         JOIN models m_voice ON m_voice.id = am_voice.model_id
         LEFT JOIN model_endpoints me_voice_j ON me_voice_j.model_id = m_voice.id
    LEFT JOIN endpoints e_voice ON e_voice.id = me_voice_j.endpoint_id AND e_voice.active = true
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)) as voice_base_url,
        -- Voice API keys (via settings system)
        (SELECT k_voice.key FROM agent a_voice 
         JOIN agent_models am_voice ON am_voice.agent_id = a_voice.id
         JOIN models m_voice ON m_voice.id = am_voice.model_id
         LEFT JOIN model_providers mp_voice ON mp_voice.model_id = m_voice.id
         LEFT JOIN providers p_voice_prov ON p_voice_prov.id = mp_voice.providers_id
         CROSS JOIN active_settings act_s_voice
         LEFT JOIN setting_provider_keys spk_voice ON spk_voice.providers_id = p_voice_prov.id 
             AND spk_voice.settings_id = act_s_voice.settings_id 
             AND spk_voice.active = true
         LEFT JOIN keys k_voice ON k_voice.id = spk_voice.key_id 
             AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k_voice.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = true)
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)) as voice_api_key,
        -- Voice prompt/temperature/reasoning (from agent)
        (SELECT COALESCE(pr_prompt_voice_dept.system_prompt, pr_prompt_voice_default.system_prompt, '')
         FROM agent a_voice
         LEFT JOIN agent_department_prompts adp_prompt_voice ON adp_prompt_voice.agent_id = a_voice.id 
             AND adp_prompt_voice.department_id = (SELECT department_id FROM resolved_dept) 
             AND adp_prompt_voice.active = true
         LEFT JOIN prompts pr_prompt_voice_dept ON pr_prompt_voice_dept.id = adp_prompt_voice.prompt_id
         LEFT JOIN agent_prompts ap_voice_default ON ap_voice_default.agent_id = a_voice.id AND ap_voice_default.active = true
         LEFT JOIN prompts pr_prompt_voice_default ON pr_prompt_voice_default.id = ap_voice_default.prompt_id
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)) as voice_system_prompt,
        (SELECT COALESCE(mtl_voice.temperature, 0.0)
         FROM agent a_voice
         JOIN agent_models am_voice ON am_voice.agent_id = a_voice.id
         JOIN models m_voice ON m_voice.id = am_voice.model_id
         LEFT JOIN agent_temperature_levels atl_voice ON atl_voice.agent_id = a_voice.id AND atl_voice.active = true
         LEFT JOIN model_temperature_levels mtl_voice ON mtl_voice.id = atl_voice.model_temperature_level_id 
             AND mtl_voice.active = true AND mtl_voice.model_id = m_voice.id
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)) as voice_temperature,
        (SELECT mrl_voice.reasoning_level
         FROM agent a_voice
         JOIN agent_models am_voice ON am_voice.agent_id = a_voice.id
         JOIN models m_voice ON m_voice.id = am_voice.model_id
         LEFT JOIN agent_reasoning_levels arl_voice ON arl_voice.agent_id = a_voice.id AND arl_voice.active = true
         LEFT JOIN model_reasoning_levels mrl_voice ON mrl_voice.id = arl_voice.model_reasoning_level_id 
             AND mrl_voice.active = true AND mrl_voice.model_id = m_voice.id
         LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
         LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
         WHERE a_voice.id = adom_voice.agent_id 
           AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a_voice.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)) as voice_reasoning,
        -- Text agent/model data (for compatibility - not used in voice mode)
        NULL::text as system_prompt,
        NULL::float as temperature,
        NULL::text as reasoning,
        NULL::uuid as model_id,
        NULL::text as model_name,
        NULL::text as custom_model,
        NULL::uuid as provider_id,
        NULL::text as provider_name,
        NULL::text as base_url,
        NULL::text as api_key,
        NULL::uuid as agent_id,
        -- Settings data (for API keys)
        st.id as settings_id,
        -- Profile data
        pf.profile_id,
        -- Rate limit data
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at
    FROM params p_params
    JOIN chat sc ON sc.id = p_params.chat_id
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    INNER JOIN simulation sim ON sim.id = sa.simulation_id
    LEFT JOIN simulation_agent_domains sd_voice ON sd_voice.simulation_id = sim.id AND sd_voice.type = 'voice'::type_simulation_domains
    LEFT JOIN agent_domains adom_voice ON adom_voice.domain_id = sd_voice.agent_domain_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    CROSS JOIN group_data g
    LEFT JOIN active_settings ast ON true
    LEFT JOIN setting st ON st.id = ast.settings_id
    LEFT JOIN profile_from_attempt pf ON true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    WHERE sc.id = p_params.chat_id
        -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
        AND validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
    LIMIT 1
),
create_run AS (
    -- Create run record with all junction records (atomic with context query)
    INSERT INTO run (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, NULL, cd.voice_agent_id
    FROM context_data cd
    WHERE cd.voice_agent_id IS NOT NULL
    RETURNING id
),
link_model AS (
    -- Link voice model to run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.id, cd.voice_model_id, true
    FROM create_run cr
    CROSS JOIN context_data cd
    WHERE cd.voice_model_id IS NOT NULL
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.profile_id IS NOT NULL
    RETURNING run_id
),
link_group AS (
    -- Link run to existing group via group_runs junction table
    INSERT INTO group_runs (group_id, run_id, idx)
    SELECT 
        gd.group_id,
        cr.id as run_id,
        (SELECT COALESCE(MAX(idx), -1) + 1 FROM group_runs WHERE group_id = gd.group_id) as idx
    FROM group_data gd
    CROSS JOIN create_run cr
    RETURNING group_id, run_id
),
link_existing_messages AS (
    -- Link existing system/developer messages from previous runs to new run
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT DISTINCT mr.message_id, cr.id, NOW(), NOW()
    FROM previous_runs_in_group prig
    CROSS JOIN create_run cr
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN message m ON m.id = mr.message_id
    WHERE m.role IN ('system'::message_role, 'developer'::message_role)
    ON CONFLICT (message_id, run_id)
    DO UPDATE SET updated_at = NOW()
)
SELECT 
    -- Context data
    cd.chat_id,
    cd.chat_title,
    cd.created_at,
    cd.trace_id,
    cd.attempt_id,
    cd.simulation_id,
    cd.scenario_id,
    cd.problem_statement,
    cd.department_id,
    cd.persona_id,
    cd.persona_name,
    cd.system_prompt,
    cd.temperature,
    cd.reasoning,
    cd.voice_system_prompt,
    cd.voice_temperature,
    cd.voice_reasoning,
    cd.model_id,
    cd.model_name,
    cd.custom_model,
    cd.voice_model_id,
    cd.voice_model_name,
    cd.voice_custom_model,
    cd.provider_id,
    cd.provider_name,
    cd.base_url,
    cd.voice_provider_id,
    cd.voice_provider,
    cd.voice_base_url,
    cd.settings_id,
    cd.api_key,
    cd.voice_api_key,
    cd.profile_id,
    cd.agent_id,
    cd.voice_agent_id,
    -- Documents data (composite type array)
    COALESCE(dd.documents, ARRAY[]::types.i_get_voice_regeneration_run_context_and_create_run_v4_document[]) as documents,
    -- Run ID (created in same transaction)
    cr.id::text as run_id,
    -- Previous messages (from all previous runs in group)
    pma.previous_messages
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
CROSS JOIN previous_messages_array pma
LEFT JOIN documents_data dd ON dd.scenario_id = cd.scenario_id
$$;