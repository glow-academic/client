-- Start simulation attempt: create attempt, link profile, select scenario, create chat
-- Converted to PostgreSQL function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_start_simulation_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_start_simulation_attempt_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITH CASCADE (to handle dependent composite types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_start_simulation_attempt_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for composite structures
CREATE TYPE types.q_start_simulation_attempt_v4_document AS (
    id text,
    name text,
    file_path text,
    mime_type text
);

CREATE TYPE types.q_start_simulation_attempt_v4_parameter_item AS (
    id text,
    name text,
    description text,
    parameter_id text,
    parameter_name text
);

CREATE TYPE types.q_start_simulation_attempt_v4_simulation_data AS (
    id text,
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    rubric_id text
);

CREATE TYPE types.q_start_simulation_attempt_v4_scenario_metadata AS (
    persona_id text,
    persona_name text,
    persona_system_prompt text,
    persona_temperature float,
    persona_reasoning text,
    persona_color text,
    persona_icon text,
    model_id text,
    model_name text,
    provider text,
    provider_base_url text,
    provider_api_key text,
    documents types.q_start_simulation_attempt_v4_document[],
    parameter_items types.q_start_simulation_attempt_v4_parameter_item[],
    active boolean,
    default_scenario boolean,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_start_simulation_attempt_v4(
    simulation_id uuid,
    infinite_mode boolean,
    profile_id uuid DEFAULT NULL,
    scenario_id_override uuid DEFAULT NULL
)
RETURNS TABLE (
    attempt_id text,
    chat_id text,
    chat_title text,
    scenario_id text,
    scenario_name text,
    problem_statement text,
    needs_generation boolean,
    content_type text,
    video_id text,
    trace_id text,
    simulation_data types.q_start_simulation_attempt_v4_simulation_data,
    scenario_metadata types.q_start_simulation_attempt_v4_scenario_metadata
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    -- Wrap all function parameters in a CTE for asyncpg prepared statement compatibility
    SELECT 
        simulation_id::uuid as simulation_id,
        infinite_mode::boolean as infinite_mode,
        profile_id::uuid as profile_id,
        scenario_id_override::uuid as scenario_id_override
),
-- Create the attempt first
new_attempt AS (
    INSERT INTO simulation_attempts (simulation_id, infinite_mode, created_at)
    SELECT p.simulation_id, p.infinite_mode, now()
    FROM params p
    RETURNING id as attempt_id
),
-- Create attempt_profiles junction if profile exists
attempt_profile_link AS (
    INSERT INTO attempt_profiles (attempt_id, profile_id, active, created_at, updated_at)
    SELECT na.attempt_id, p.profile_id, true, now(), now()
    FROM new_attempt na
    CROSS JOIN params p
    WHERE p.profile_id IS NOT NULL
    RETURNING attempt_id
),
-- Get simulation data
simulation_data AS (
    SELECT 
        s.id,
        (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as title,
        (SELECT (SELECT d2.description FROM department_descriptions dd JOIN descriptions d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE) as practice_simulation,
        (SELECT sd.agent_domain_id FROM simulation_agent_domains sd WHERE sd.simulation_id = s.id AND sd.type = 'text'::type_simulation_domains LIMIT 1) as simulation_text_domain_id,
        (SELECT sd.agent_domain_id FROM simulation_agent_domains sd WHERE sd.simulation_id = s.id AND sd.type = 'voice'::type_simulation_domains LIMIT 1) as simulation_voice_domain_id,
        (SELECT rga.rubric_id FROM simulation_scenarios ss 
         JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ss.simulation_id AND ssrga.scenario_id = ss.scenario_id
         JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
         WHERE ss.simulation_id = s.id AND ss.active = true 
         ORDER BY ss.position 
         LIMIT 1) as rubric_id
    FROM params p
    JOIN simulations s ON s.id = p.simulation_id
),
-- Get simulation scenarios in order
simulation_scenarios AS (
    SELECT 
        ss.scenario_id,
        ss.position
    FROM params p
    JOIN simulation_scenarios ss ON ss.simulation_id = p.simulation_id AND ss.active = true
    ORDER BY ss.position
),
-- Determine content type (always scenario now - videos are accessed through scenarios)
content_type_check AS (
    SELECT 
        'scenario' as content_type,
        NULL::uuid as first_video_id
),
-- Determine chosen scenario
chosen_scenario_id AS (
    SELECT 
        CASE 
            WHEN p.scenario_id_override IS NOT NULL THEN p.scenario_id_override
            WHEN EXISTS(SELECT 1 FROM simulation_scenarios) THEN 
                (SELECT scenario_id FROM simulation_scenarios 
                 ORDER BY position LIMIT 1)
            ELSE (
                SELECT s.id 
                FROM scenarios s 
                ORDER BY random() 
                LIMIT 1
            )
        END as scenario_id
    FROM params p
),
-- Resolve department_id for agent prompt selection (scenario -> profile -> any active)
scenario_dept AS (
    SELECT 
        csi.scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = csi.scenario_id AND sd.active = true LIMIT 1) as department_id
    FROM chosen_scenario_id csi
),
profile_dept AS (
    -- Get first department from profile's accessible departments
    SELECT d.id as department_id
    FROM params p
    JOIN departments d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = p.profile_id 
      AND pd.active = true
    LIMIT 1
),
any_active_dept AS (
    -- Get any active department as last resort
    SELECT d.id as department_id
    FROM departments d
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
-- Get active settings for profile (for key lookup via setting_provider_keys)
default_settings AS (
    -- Get settings with no department links (cross-department/default)
    SELECT s.id as settings_id
    FROM settings s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
profile_primary_department AS (
    -- Get profile's primary department ID (only if profile_id is provided)
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id
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
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) 
      AND sd.active = true
    LIMIT 1
),
active_settings AS (
    -- For authenticated users: prefer department-specific, then default, then any active
    -- For NULL profile_id: use default settings
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
),
-- Document data for composite type aggregation
document_data AS (
    SELECT 
        s.id as scenario_id,
        d.id as document_id,
        (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        u.file_path,
        u.mime_type
    FROM scenarios s
    CROSS JOIN chosen_scenario_id csi
    LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id AND sd.active = true
    LEFT JOIN documents d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    WHERE s.id = csi.scenario_id
),
-- Parameter item data for composite type aggregation
parameter_item_data AS (
    SELECT 
        s.id as scenario_id,
        f.id as field_id,
        (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = p_param.id LIMIT 1) as parameter_name
    FROM scenarios s
    CROSS JOIN chosen_scenario_id csi
    LEFT JOIN scenario_fields sf ON sf.scenario_id = s.id AND sf.active = true
    LEFT JOIN fields f ON f.id = sf.field_id
    LEFT JOIN parameters p_param ON p_param.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
    WHERE s.id = csi.scenario_id
),
-- Get full scenario data with all metadata
-- CRITICAL FIX: Use DISTINCT ON to ensure only ONE row per scenario
-- Multiple agents/models for the same persona can cause multiple rows, leading to duplicate chats
scenario_full_data_raw AS (
    SELECT 
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as scenario_name,
        ps.problem_statement,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE) as active,
        false as generated,
        false as default_scenario,
        -- Persona data
        p.id as persona_id,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as persona_name,
        COALESCE(
            COALESCE(pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt),
            ''
        ) as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        (SELECT c.hex_code FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as persona_color,
        (SELECT i.name FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as persona_icon,
        -- Model data
        m.id as model_id,
        m.value as model_name,
        COALESCE(p_prov.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        -- Check if scenario needs generation
        CASE 
            WHEN ps.problem_statement IS NULL OR ps.problem_statement = '' THEN true
            ELSE false
        END as needs_generation
    FROM scenarios s
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    CROSS JOIN chosen_scenario_id csi
    LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
    LEFT JOIN personas p ON p.id = sp.persona_id
    CROSS JOIN simulation_data sd_agents
    LEFT JOIN agent_domains adom_text ON adom_text.domain_id = sd_agents.simulation_text_domain_id
    LEFT JOIN agents a ON a.id = adom_text.agent_id AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    LEFT JOIN agent_models am ON am.agent_id = a.id
    LEFT JOIN models m ON m.id = am.model_id
    -- Join temperature and reasoning from model levels via agent
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    -- IMPORTANT: Only join reasoning levels that belong to the agent's model (m.id = mrl.model_id)
    LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
    -- Try department-specific agent prompt first, fall back to default prompt
    CROSS JOIN resolved_dept rd
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id 
        AND adp_prompt.department_id = rd.department_id
        AND adp_prompt.active = true
    LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN model_providers mp_prov ON mp_prov.model_id = m.id
    LEFT JOIN providers p_prov ON p_prov.id = mp_prov.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    WHERE s.id = csi.scenario_id
    GROUP BY s.id, (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), ps.problem_statement, EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE), 
             CASE WHEN ps.problem_statement IS NULL OR ps.problem_statement = '' THEN true ELSE false END, p.id, (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt, 
             COALESCE(mtl.temperature, 0.0), mrl.reasoning_level, (SELECT c.hex_code FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1), (SELECT i.name FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1), m.id, m.value, p_prov.value,
             k.key, me.base_url, act_s.settings_id
),
-- Select only ONE row per scenario (deterministic: pick first model by ID)
scenario_full_data AS (
    SELECT DISTINCT ON (scenario_id) *
    FROM scenario_full_data_raw
    ORDER BY scenario_id, model_id
),
-- Create simulation chat (only for scenarios, not videos)
new_chat AS (
    INSERT INTO chats (
        created_at, title, scenario_id, completed, updated_at
    )
    SELECT 
        now(),
        COALESCE(sfd.scenario_name, 'New Simulation'),
        sfd.scenario_id,
        false,
        now()
    FROM new_attempt na
    CROSS JOIN scenario_full_data sfd
    CROSS JOIN content_type_check ctc
    WHERE ctc.content_type = 'scenario'
    RETURNING id as chat_id, title as chat_title, created_at, updated_at
),
-- Create group (trace_id auto-generated by database default)
new_group AS (
    INSERT INTO groups (created_at, updated_at)
    SELECT nc.created_at, nc.updated_at
    FROM new_chat nc
    RETURNING id as group_id, trace_id
),
-- Link chat to group
chat_group_link AS (
    INSERT INTO chat_groups (chat_id, group_id, created_at, updated_at)
    SELECT nc.chat_id, ng.group_id, nc.created_at, nc.updated_at
    FROM new_chat nc
    CROSS JOIN new_group ng
    RETURNING chat_id, group_id
),
-- Create attempt_chats junction table entry (only if chat was created)
attempt_chat_link AS (
    INSERT INTO attempt_chats (attempt_id, chat_id, created_at, updated_at)
    SELECT na.attempt_id, nc.chat_id, nc.created_at, nc.updated_at
    FROM new_attempt na
    CROSS JOIN new_chat nc
    RETURNING attempt_id, chat_id
)
-- Return all data in single row
SELECT 
    na.attempt_id::text,
    CASE WHEN ctc.content_type = 'scenario' THEN nc.chat_id::text ELSE NULL::text END as chat_id,
    CASE WHEN ctc.content_type = 'scenario' THEN nc.chat_title ELSE NULL::text END as chat_title,
    CASE WHEN ctc.content_type = 'scenario' THEN sfd.scenario_id::text ELSE NULL::text END as scenario_id,
    CASE WHEN ctc.content_type = 'scenario' THEN sfd.scenario_name ELSE NULL::text END as scenario_name,
    CASE WHEN ctc.content_type = 'scenario' THEN sfd.problem_statement ELSE NULL::text END as problem_statement,
    CASE WHEN ctc.content_type = 'scenario' THEN sfd.needs_generation ELSE false END as needs_generation,
    ctc.content_type,
    NULL::text as video_id,
    ng.trace_id::text as trace_id,
    -- Simulation metadata as composite type
    (sd.id::text, sd.title, sd.description, sd.active, sd.practice_simulation, sd.rubric_id::text)::types.q_start_simulation_attempt_v4_simulation_data as simulation_data,
    -- Scenario metadata as composite type (only for scenarios)
    CASE 
        WHEN ctc.content_type = 'scenario' THEN
            (
                sfd.persona_id::text,
                sfd.persona_name,
                sfd.system_prompt,
                sfd.temperature,
                sfd.reasoning,
                sfd.persona_color,
                sfd.persona_icon,
                sfd.model_id::text,
                sfd.model_name,
                sfd.provider,
                sfd.base_url,
                sfd.api_key,
                COALESCE(
                    (SELECT ARRAY_AGG(
                        (dd.document_id::text, dd.name, dd.file_path, dd.mime_type)::types.q_start_simulation_attempt_v4_document
                        ORDER BY dd.document_id
                    ) FROM document_data dd WHERE dd.scenario_id = sfd.scenario_id),
                    '{}'::types.q_start_simulation_attempt_v4_document[]
                ),
                COALESCE(
                    (SELECT ARRAY_AGG(
                        (pid.field_id::text, pid.name, pid.description, pid.parameter_id::text, pid.parameter_name)::types.q_start_simulation_attempt_v4_parameter_item
                        ORDER BY pid.field_id
                    ) FROM parameter_item_data pid WHERE pid.scenario_id = sfd.scenario_id),
                    '{}'::types.q_start_simulation_attempt_v4_parameter_item[]
                ),
                sfd.active,
                sfd.default_scenario,
                sfd.generated
            )::types.q_start_simulation_attempt_v4_scenario_metadata
        ELSE NULL::types.q_start_simulation_attempt_v4_scenario_metadata
    END as scenario_metadata
FROM new_attempt na
CROSS JOIN content_type_check ctc
CROSS JOIN simulation_data sd
LEFT JOIN new_chat nc ON ctc.content_type = 'scenario'
LEFT JOIN attempt_chat_link acl ON acl.chat_id = nc.chat_id AND acl.attempt_id = na.attempt_id AND ctc.content_type = 'scenario'
LEFT JOIN chat_group_link cgl ON cgl.chat_id = nc.chat_id AND ctc.content_type = 'scenario'
LEFT JOIN new_group ng ON ng.group_id = cgl.group_id AND ctc.content_type = 'scenario'
LEFT JOIN scenario_full_data sfd ON ctc.content_type = 'scenario' AND sfd.scenario_id = (SELECT scenario_id FROM chosen_scenario_id)
$$;