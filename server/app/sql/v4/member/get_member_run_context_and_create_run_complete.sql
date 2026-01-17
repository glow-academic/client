-- Get all data needed to run member agent AND create run in single atomic transaction
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
        WHERE proname = 'socket_get_member_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_member_run_context_and_create_run_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_member_run_context_and_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for composite structures
CREATE TYPE types.q_get_member_run_context_and_create_run_v4_document AS (
    id text,
    name text,
    file_path text,
    mime_type text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_get_member_run_context_and_create_run_v4(
    chat_id uuid,
    profile_id uuid,
    group_id uuid DEFAULT NULL
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
    image_input_enabled boolean,
    copy_paste_allowed boolean,
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    documents types.q_get_member_run_context_and_create_run_v4_document[],
    run_id text,
    group_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        chat_id AS chat_id,
        profile_id AS profile_id,
        group_id AS group_id
),
scenario_dept AS (
    SELECT 
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios_resource s ON s.id = sc.scenario_id
    CROSS JOIN params p
    WHERE sc.id = p.chat_id
),
profile_dept AS (
    -- Get first department FROM profile_artifact's accessible departments
    SELECT d.id as department_id
    FROM department_artifact d
    JOIN profile_departments pd ON pd.department_id = d.id
    JOIN attempt_profiles ap ON ap.profile_id = pd.profile_id
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id
    CROSS JOIN params p
    WHERE ac.chat_id = p.chat_id 
      AND ap.active = true 
      AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
    LIMIT 1
),
any_active_dept AS (
    -- Get any active department as last resort
    SELECT id as department_id
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
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
        rl.requests_per_day as req_per_day
    FROM profile_artifact prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    CROSS JOIN params p
    WHERE prof.id = (SELECT ap.profile_id FROM attempt_profiles ap 
                  JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
                  CROSS JOIN params p2
                  WHERE ac.chat_id = p2.chat_id AND ap.active = true LIMIT 1)
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
                            CROSS JOIN params p2
                            WHERE ac.chat_id = p2.chat_id AND ap.active = true LIMIT 1)
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
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true)
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
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    -- Settings that have at least one active provider key
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys_resource kr ON kr.id = spk.key_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags_resource f ON kf.flag_id = f.id WHERE kf.key_id = kr.id AND f.name = 'active' AND kf.value = TRUE) = true
),
dept_specific_settings_with_keys AS (
    -- Department-specific settings that have keys
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    -- Default settings that have keys
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
    -- Prefer department-specific with keys, then default with keys, then any with keys, then fallback
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT s.id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true) LIMIT 1)
        ) as settings_id
),
create_group_if_needed AS (
    -- Create new group if group_id is NULL
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params p
    WHERE p.group_id IS NULL
    RETURNING id as group_id, trace_id
),
group_data AS (
    -- Use existing group if provided, otherwise use newly created group
    SELECT 
        COALESCE(
            (SELECT g.id FROM groups g CROSS JOIN params p_group WHERE g.id = p_group.group_id),
            (SELECT cg.group_id FROM create_group_if_needed cg)
        ) as group_id,
        COALESCE(
            (SELECT g.trace_id FROM groups g CROSS JOIN params p_group WHERE g.id = p_group.group_id),
            (SELECT cg.trace_id FROM create_group_if_needed cg)
        ) as trace_id
),
-- Get member agent (role='member')
member_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    
    
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    ORDER BY a.created_at ASC
    LIMIT 1
),
context_data AS (
    -- Get all context data (agent, model, provider, persona, documents, etc.)
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
        
        -- Persona data (via scenario_personas junction - first persona for student)
        first_persona.persona_id::text as persona_id,
        first_persona.persona_name as persona_name,
        
        -- Member agent/model data
        COALESCE(
            pr_prompt_default.system_prompt,
            ''
        ) as system_prompt,
        COALESCE(tl.temperature, 0.0) as temperature,
        rl.reasoning_level as reasoning,
        m.id::text as model_id,
        (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(e.base_url, '') as base_url,
        kr.key as api_key,
        CASE WHEN e.base_url IS NOT NULL AND e.base_url != '' THEN (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) ELSE NULL END as custom_model,
        NULL::text as provider_id,
        COALESCE(n_prov.name, '') as provider_name,
        ma.agent_id::text as agent_id,
        
        -- Scenario settings (flags moved FROM scenario_artifact to simulation_scenarios)
        COALESCE(EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'images_enabled' AND sf.value = TRUE), false) as image_input_enabled,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND ssf.scenario_id = ss.scenario_id 
            AND f.name = 'copy_paste_allowed'), false) as copy_paste_allowed,
        
        -- Profile data (via attempt_profiles junction)
        ap.profile_id::text as profile_id,
        
        -- Rate limit data
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at

    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios_resource s ON s.id = sc.scenario_id
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = sa.simulation_id AND ss.scenario_id = s.id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    JOIN chat_groups cg ON cg.chat_id = sc.id
    JOIN groups g ON g.id = cg.group_id
    -- Get first persona for student (ensures single row for member config)
    LEFT JOIN (
        SELECT DISTINCT ON (sp.scenario_id) 
            sp.scenario_id,
            sp.persona_id,
            (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = sp.persona_id LIMIT 1) as persona_name
        FROM scenario_personas sp
        WHERE sp.active = true AND EXISTS (SELECT 1 FROM persona_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = sp.persona_id AND f.name = 'active' AND pf.value = true)
        ORDER BY sp.scenario_id, (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = sp.persona_id LIMIT 1)
    ) first_persona ON first_persona.scenario_id = s.id

    -- Member agent joins (use member agent instead of simulation agent)
    CROSS JOIN member_agent ma
    JOIN agents_resource a ON a.id = ma.agent_id AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    INNER JOIN agent_models am ON am.agent_id = a.id
    LEFT JOIN models_resource m ON m.id = am.model_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = m.id 
LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = m.id 
LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
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
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    CROSS JOIN resolved_dept
    CROSS JOIN params p_final
    WHERE sc.id = p_final.chat_id
        -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
        AND validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
    GROUP BY sc.id, sc.title, g.trace_id,
             sa.id, sa.simulation_id,
             s.id, ps.problem_statement,
             first_persona.persona_id, first_persona.persona_name,
             n_prov.name,
             -- Member agent fields
             pr_prompt_default.system_prompt, COALESCE(tl.temperature, 0.0), rl.reasoning_level,
             m.id, (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1), n_prov.name, kr.key, e.base_url, ma.agent_id, act_s.settings_id,
             -- Other fields
             EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'images_enabled' AND sf.value = TRUE), 
             COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
                 AND ssf.scenario_id = ss.scenario_id 
                 AND f.name = 'copy_paste_allowed'), false),
             ap.profile_id,
             prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at
),
documents_data AS (
    -- Get documents as composite type array
    SELECT 
        sc.id as chat_id,
        ARRAY_AGG(
            (d.id::text, (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), u.file_path, u.mime_type)::types.q_get_member_run_context_and_create_run_v4_document
            ORDER BY d.id
        ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true) as documents
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios_resource s ON s.id = sc.scenario_id
    LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
    LEFT JOIN documents_resource d ON d.id = sd.document_id
    LEFT JOIN document_uploads_resource dur ON dur.document_id = d.id AND dur.active = true
    LEFT JOIN uploads_resource ur ON ur.id = dur.uploads_id
    LEFT JOIN uploads u ON u.id = ur.upload_id
    CROSS JOIN params p
    WHERE sc.id = p.chat_id
    GROUP BY sc.id
),
create_run AS (
    -- Create run record with all junction records (atomic with context query)
    INSERT INTO runs (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, NULL, cd.agent_id::uuid
    FROM context_data cd
    RETURNING id
),
link_model AS (
    -- Link model to run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.id, cd.model_id::uuid, true
    FROM create_run cr
    CROSS JOIN context_data cd
    RETURNING run_id
),
link_persona AS (
    -- Link persona to run
    INSERT INTO run_personas (run_id, persona_id, active)
    SELECT lm.run_id, cd.persona_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.persona_id IS NOT NULL
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.profile_id IS NOT NULL
    RETURNING run_id
),
link_group AS (
    -- Link run to group via group_runs junction table
    INSERT INTO group_runs (group_id, run_id, idx)
    SELECT 
        gd.group_id,
        cr.id as run_id,
        COALESCE(
            (SELECT MAX(idx) FROM group_runs WHERE group_id = gd.group_id),
            -1
        ) + 1 as idx
    FROM group_data gd
    CROSS JOIN create_run cr
    RETURNING group_id, run_id
)
SELECT 
    -- Context data
    cd.chat_id,
    cd.chat_title,
    cd.trace_id,
    cd.attempt_id,
    cd.simulation_id,
    cd.scenario_id,
    cd.department_id,
    cd.problem_statement,
    cd.persona_id,
    cd.persona_name,
    cd.system_prompt,
    cd.temperature,
    cd.reasoning,
    cd.model_id,
    cd.model_name,
    cd.provider,
    cd.base_url,
    cd.api_key,
    cd.custom_model,
    cd.provider_id,
    cd.provider_name,
    cd.agent_id,
    cd.image_input_enabled,
    cd.copy_paste_allowed,
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    COALESCE(dd.documents, ARRAY[]::types.q_get_member_run_context_and_create_run_v4_document[]) as documents,
    -- Run ID (created in same transaction)
    cr.id::text as run_id,
    -- Group ID (from groups table)
    gd.group_id
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
LEFT JOIN documents_data dd ON dd.chat_id::text = cd.chat_id
$$;