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
    chat_id uuid,
    p_agent_id uuid DEFAULT NULL
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
    FROM view_simulation_chats_entry
),
-- Unified attempts (general + practice)
all_attempts AS (
    SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active
    FROM view_simulation_attempts_entry
),
-- Unified chat→scenario connections
all_chat_scenarios AS (
    SELECT chat_id, scenario_id AS scenarios_id, chat_created_at AS created_at
    FROM mv_attempt_chats
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
        (SELECT department_id FROM scenario_dept LIMIT 1),
        (SELECT department_id FROM profile_dept LIMIT 1),
        (SELECT department_id FROM any_active_dept LIMIT 1)
    ) as department_id
),
profile_rate_limit AS (
    -- Get rate limit for the profile (via view_attempts_entry)
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
    -- Count model view_runs_entry for this profile since start of day
    SELECT
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM view_runs_entry mr
    JOIN profiles_runs_connection prj ON prj.run_id = mr.id
    WHERE prj.profiles_id = (SELECT ppj.profile_id FROM all_chats sc
                            JOIN all_attempts sa ON sa.id = sc.attempt_id
                            JOIN all_attempt_profiles aap ON aap.attempt_id = sa.id
                            JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id
                            WHERE sc.id = chat_id AND aap.profiles_id IS NOT NULL LIMIT 1)
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
)
SELECT 
    -- Chat data
    sc.id::text as chat_id,
    sc.title as chat_title,
    (SELECT g.trace_id FROM view_simulation_messages_entry m_t JOIN view_runs_entry r_t ON r_t.id = m_t.run_id JOIN view_groups_entry g ON g.id = r_t.group_id WHERE m_t.chat_id = sc.id LIMIT 1) as trace_id,
    
    -- Attempt data
    sa.id::text as attempt_id,
    sim_ssj.simulation_id::text,
    
    -- Scenario data
    s.id::text as scenario_id,
    (SELECT department_id::text FROM resolved_dept LIMIT 1) as department_id,
    ps.problem_statement,
    
    -- Persona data (via scenario_personas_junction junction - first persona for orchestrator)
    first_persona.persona_id::text as persona_id,
    first_persona.persona_name as persona_name,
    
    -- Text agent/model data (backward compatibility - existing fields)
    COALESCE(pr_prompt_default.system_prompt, '') as system_prompt,
    COALESCE(a.temperature, 0.0) as temperature,
    a.reasoning as reasoning,
    m.id::text as model_id,
    m.value as model_name,
    COALESCE(n_prov.name, '') as provider,
    COALESCE(pr.endpoint, '') as base_url,
    pr.key as api_key,
    CASE WHEN pr.endpoint IS NOT NULL AND pr.endpoint != '' THEN m.value ELSE NULL END as custom_model,
    NULL::text as provider_id,
    COALESCE(n_prov.name, '') as provider_name,
    p_agent_id::text as agent_id,

    -- Voice agent/model data (prefixed with voice_*)
    COALESCE(pr_prompt_voice_default.system_prompt, '') as voice_system_prompt,
    COALESCE(a_voice.temperature, 0.0) as voice_temperature,
    a_voice.reasoning as voice_reasoning,
    m_voice.id::text as voice_model_id,
    m_voice.value as voice_model_name,
    COALESCE(n_voice_prov.name, '') as voice_provider,
    COALESCE(pr_voice.endpoint, '') as voice_base_url,
    pr_voice.key as voice_api_key,
    CASE WHEN pr_voice.endpoint IS NOT NULL AND pr_voice.endpoint != '' THEN m_voice.value ELSE NULL END as voice_custom_model,
    COALESCE(n_voice_prov.name, '') as voice_provider_name,
    p_agent_id::text as voice_agent_id,
    
    -- Scenario settings (flags moved FROM scenario_artifact to simulation_scenarios_junction)
        COALESCE(EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'images_enabled' AND sf.value = TRUE), false) as image_input_enabled,
    COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
        AND sfr.scenario_id = ss.scenario_id
        AND f.name = 'copy_paste_allowed' LIMIT 1), false) as copy_paste_allowed,

    -- Profile data (via view_attempts_entry)
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
) first_persona ON first_persona.scenario_id = ssj.scenario_id

-- Text agent joins (use p_agent_id parameter passed from frontend)
-- p_agent_id is an agent_artifact.id, resolve to agents_resource via agent_agents_junction

LEFT JOIN agent_agents_junction aaj ON aaj.agent_id = p_agent_id AND aaj.active = true
LEFT JOIN agents_resource a ON a.id = aaj.agents_id AND a.active = true
-- Model directly from agents_resource.model_id
LEFT JOIN models_resource m ON m.id = a.model_id
LEFT JOIN agent_prompts_junction ap_prompt ON ap_prompt.agent_id = p_agent_id AND ap_prompt.active = true
LEFT JOIN prompts_resource pr_prompt_default ON pr_prompt_default.id = ap_prompt.prompt_id
-- Get provider via models_resource.provider_id
LEFT JOIN providers_resource pr ON pr.id = m.provider_id
LEFT JOIN provider_providers_junction ppj ON ppj.providers_id = pr.id
LEFT JOIN provider_names_junction pn_prov ON pn_prov.provider_id = ppj.provider_id
LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id

-- Voice agent joins (use p_agent_id parameter passed from frontend - same as text for now)
-- p_agent_id is an agent_artifact.id, resolve to agents_resource via agent_agents_junction

LEFT JOIN agent_agents_junction aaj_voice ON aaj_voice.agent_id = p_agent_id AND aaj_voice.active = true
LEFT JOIN agents_resource a_voice ON a_voice.id = aaj_voice.agents_id AND a_voice.active = true
-- Model directly from agents_resource.model_id
LEFT JOIN models_resource m_voice ON m_voice.id = a_voice.model_id
LEFT JOIN agent_prompts_junction ap_voice ON ap_voice.agent_id = p_agent_id AND ap_voice.active = true
LEFT JOIN prompts_resource pr_prompt_voice_default ON pr_prompt_voice_default.id = ap_voice.prompt_id
-- Get voice provider via models_resource.provider_id
LEFT JOIN providers_resource pr_voice ON pr_voice.id = m_voice.provider_id
LEFT JOIN provider_providers_junction ppj_voice ON ppj_voice.providers_id = pr_voice.id
LEFT JOIN provider_names_junction pn_voice_prov ON pn_voice_prov.provider_id = ppj_voice.provider_id
LEFT JOIN names_resource n_voice_prov ON n_voice_prov.id = pn_voice_prov.name_id
LEFT JOIN scenario_documents_junction sd ON sd.scenario_id = s.id
LEFT JOIN documents_resource doc ON doc.id = sd.document_id
LEFT JOIN document_uploads_resource dur ON dur.document_id = doc.id AND dur.active = true
LEFT JOIN uploads_resource ur ON ur.id = dur.uploads_id
LEFT JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id
LEFT JOIN view_uploads_entry u ON u.id = uuc.upload_id
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
         pr_prompt_default.system_prompt, COALESCE(a.temperature, 0.0), a.reasoning,
         m.id, m.value, n_prov.name, pr.key, pr.endpoint, p_agent_id,
         -- Voice agent fields
         pr_prompt_voice_default.system_prompt, COALESCE(a_voice.temperature, 0.0), a_voice.reasoning,
         m_voice.id, m_voice.value, n_voice_prov.name, pr_voice.key, pr_voice.endpoint, p_agent_id,
         -- Other fields
         EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'images_enabled' AND sf.value = TRUE),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'copy_paste_allowed' LIMIT 1), false),
         aap_main.profiles_id,
         prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at
$$;
