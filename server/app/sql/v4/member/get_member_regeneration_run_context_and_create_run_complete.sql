-- Get all data needed to run member regeneration agent AND create run in single atomic transaction
-- Uses existing group_id to get previous context from previous run
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_member_regeneration_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_member_regeneration_run_context_and_create_run_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_member_regen_run_context_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate composite types
CREATE TYPE types.i_member_regen_run_context_create_run_v4_msg AS (
    role text,
    content text
);

CREATE TYPE types.i_member_regen_run_context_create_run_v4_document AS (
    id text,
    name text,
    file_path text,
    mime_type text
);

-- 4) Recreate function
-- group_id is REQUIRED (not NULL) for regeneration - uses existing group
CREATE OR REPLACE FUNCTION socket_get_member_regeneration_run_context_and_create_run_v4(
    chat_id uuid,
    profile_id uuid,
    group_id uuid,  -- REQUIRED for regeneration (not NULL)
    user_instructions text DEFAULT NULL
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
    documents types.i_member_regen_run_context_create_run_v4_document[],
    run_id text,
    group_id uuid,
    previous_messages types.i_member_regen_run_context_create_run_v4_msg[]
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
    SELECT gr.run_id
    FROM group_runs gr
    CROSS JOIN params p
    WHERE gr.group_id = p.group_id
    ORDER BY gr.idx ASC
),
previous_messages_all_runs AS (
    SELECT 
        m.role,
        cnt.content,
        m.created_at,
        gr.idx as run_idx
    FROM previous_runs_in_group prig
    JOIN group_runs gr ON gr.run_id = prig.run_id
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN message_artifact m ON m.id = mr.message_id
    LEFT JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN contents cnt ON cnt.id = mc.content_id
    ORDER BY gr.idx ASC, m.created_at ASC
),
previous_messages_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (role, content)::types.i_member_regen_run_context_create_run_v4_msg
            ORDER BY run_idx, created_at
        ),
        '{}'::types.i_member_regen_run_context_create_run_v4_msg[]
    ) as previous_messages
    FROM previous_messages_all_runs
),
scenario_dept AS (
    SELECT 
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
    FROM chat_artifact sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios_resource s ON s.id = sc.scenario_id
    CROSS JOIN params p
    WHERE sc.id = p.chat_id
),
profile_dept AS (
    SELECT d.id as department_id
    FROM department_artifact d
    JOIN profile_departments pd ON pd.department_id = d.id
    JOIN attempt_profiles ap ON ap.profile_id = pd.profile_id
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id
    CROSS JOIN params p
    WHERE ac.chat_id = p.chat_id 
      AND ap.active = true 
      AND EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
    LIMIT 1
),
any_active_dept AS (
    SELECT id as department_id
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = TRUE)
    LIMIT 1
),
resolved_dept AS (
    SELECT COALESCE(
        (SELECT department_id FROM scenario_dept),
        (SELECT department_id FROM profile_dept),
        (SELECT department_id FROM any_active_dept)
    ) as department_id
),
profile_rate_limit AS (
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
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM run_artifact mr
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
    SELECT ap.profile_id
    FROM attempt_profiles ap 
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
    CROSS JOIN params p
    WHERE ac.chat_id = p.chat_id AND ap.active = true
    LIMIT 1
),
default_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_from_attempt pfa
    JOIN profile_departments pd ON pd.profile_id = pfa.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys_resource k ON k.id = spk.key_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = k.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
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
            (SELECT id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
),
member_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('agent' AS artifacts)
    WHERE EXISTS (SELECT 1 FROM agent_flags af WHERE af.agent_id = a.id AND af.type = 'active'::type_agent_flags AND af.value = true)
    ORDER BY a.created_at ASC
    LIMIT 1
),
context_data AS (
    SELECT 
        sc.id::text as chat_id,
        sc.title as chat_title,
        gd.trace_id,
        sa.id::text as attempt_id,
        sa.simulation_id::text,
        s.id::text as scenario_id,
        (SELECT department_id::text FROM resolved_dept) as department_id,
        ps.problem_statement,
        first_persona.persona_id::text as persona_id,
        first_persona.persona_name as persona_name,
        COALESCE(
            COALESCE(pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt),
            ''
        ) as system_prompt,
        COALESCE(tl.temperature, 0.0) as temperature,
        rl.reasoning_level as reasoning,
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(e.base_url, '') as base_url,
        k.key as api_key,
        CASE WHEN e.base_url IS NOT NULL AND e.base_url != '' THEN m.value ELSE NULL END as custom_model,
        NULL::text as provider_id,
        COALESCE(n_prov.name, '') as provider_name,
        ma.agent_id::text as agent_id,
        COALESCE(EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'images_enabled'::type_scenario_flags AND sf.value = TRUE), false) as image_input_enabled,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf 
          WHERE ssf.simulation_id = ss.simulation_id 
            AND ssf.scenario_id = ss.scenario_id 
            AND ssf.type = 'copy_paste_allowed'::type_simulation_scenario_flags), false) as copy_paste_allowed,
        ap.profile_id::text as profile_id,
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at
    FROM chat_artifact sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios_resource s ON s.id = sc.scenario_id
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = sa.simulation_id AND ss.scenario_id = s.id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    CROSS JOIN group_data gd
    LEFT JOIN (
        SELECT DISTINCT ON (sp.scenario_id) 
            sp.scenario_id,
            sp.persona_id,
            (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = sp.persona_id LIMIT 1) as persona_name
        FROM scenario_personas sp
        WHERE sp.active = true AND EXISTS (SELECT 1 FROM persona_flags pf WHERE pf.persona_id = sp.persona_id AND pf.type = 'active'::type_persona_flags AND pf.value = true)
        ORDER BY sp.scenario_id, (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = sp.persona_id LIMIT 1)
    ) first_persona ON first_persona.scenario_id = s.id
    CROSS JOIN member_agent ma
    JOIN agents_resource a ON a.id = ma.agent_id AND EXISTS (SELECT 1 FROM agent_flags af WHERE af.agent_id = a.id AND af.type = 'active'::type_agent_flags AND af.value = true)
    LEFT JOIN agent_models am ON am.agent_id = a.id
    LEFT JOIN models_resource m ON m.id = am.model_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = m.id 
LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = m.id 
LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id 
        AND adp_prompt.department_id = (SELECT department_id FROM resolved_dept)
        AND adp_prompt.active = true
    LEFT JOIN prompts_resource pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    LEFT JOIN model_endpoints me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true
    LEFT JOIN model_providers mp ON mp.model_id = m.id
    LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
    LEFT JOIN provider_artifact pr_prov ON pr_prov.id = p_prov.provider_id
    LEFT JOIN provider_names pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.providers_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys_resource k ON k.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = k.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    CROSS JOIN resolved_dept
    CROSS JOIN params p_final
    WHERE sc.id = p_final.chat_id
        AND validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
    GROUP BY sc.id, sc.title, gd.trace_id,
             sa.id, sa.simulation_id,
             s.id, ps.problem_statement,
             first_persona.persona_id, first_persona.persona_name,
             n_prov.name,
             pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt, COALESCE(tl.temperature, 0.0), rl.reasoning_level,
             m.id, m.value, n_prov.name, k.key, e.base_url, ma.agent_id, act_s.settings_id,
             EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'images_enabled'::type_scenario_flags AND sf.value = TRUE), 
             COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf 
               WHERE ssf.simulation_id = ss.simulation_id 
                 AND ssf.scenario_id = ss.scenario_id 
                 AND ssf.type = 'copy_paste_allowed'::type_simulation_scenario_flags), false),
             ap.profile_id,
             prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at
),
documents_data AS (
    SELECT 
        sc.id as chat_id,
        ARRAY_AGG(
            (d.id::text, (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), u.file_path, u.mime_type)::types.i_member_regen_run_context_create_run_v4_document
            ORDER BY d.id
        ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true) as documents
    FROM chat_artifact sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios_resource s ON s.id = sc.scenario_id
    LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
    LEFT JOIN documents_resource d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    CROSS JOIN params p
    WHERE sc.id = p.chat_id
    GROUP BY sc.id
),
create_run AS (
    INSERT INTO run_artifact (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, NULL, cd.agent_id::uuid
    FROM context_data cd
    RETURNING id
),
link_model AS (
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.id, cd.model_id::uuid, true
    FROM create_run cr
    CROSS JOIN context_data cd
    RETURNING run_id
),
link_persona AS (
    INSERT INTO run_personas (run_id, persona_id, active)
    SELECT lm.run_id, cd.persona_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.persona_id IS NOT NULL
    RETURNING run_id
),
link_profile AS (
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.profile_id IS NOT NULL
    RETURNING run_id
),
link_group AS (
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
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT DISTINCT mr.message_id, cr.id, NOW(), NOW()
    FROM previous_runs_in_group prig
    CROSS JOIN create_run cr
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN message_artifact m ON m.id = mr.message_id
    WHERE m.role IN ('system'::message_role, 'developer'::message_role)
    ON CONFLICT (message_id, run_id)
    DO UPDATE SET updated_at = NOW()
)
SELECT 
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
    COALESCE(dd.documents, ARRAY[]::types.i_member_regen_run_context_create_run_v4_document[]) as documents,
    cr.id::text as run_id,
    gd.group_id,
    pma.previous_messages
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
LEFT JOIN documents_data dd ON dd.chat_id::text = cd.chat_id
CROSS JOIN previous_messages_array pma
$$;