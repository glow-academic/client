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
-- Create the attempt first with profile_id directly
new_attempt AS (
    INSERT INTO attempts_entry (simulation_id, infinite_mode, profile_id, created_at)
    SELECT p.simulation_id, p.infinite_mode, p.profile_id, now()
    FROM params p
    RETURNING id as attempt_id
),
-- Get simulation data
simulation_data AS (
    SELECT 
        s.id,
        (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as title,
        (SELECT (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE) as practice_simulation,
        (SELECT srr.rubric_id FROM simulation_scenarios ss 
         JOIN simulation_scenario_rubrics ssr ON ssr.simulation_id = ss.simulation_id
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
         WHERE ss.simulation_id = s.id 
           AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
               AND sfr.scenario_id = ss.scenario_id 
               AND f.name = 'simulation_active' 
               AND ssf.value = true)
         ORDER BY (SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
         LIMIT 1) as rubric_id
    FROM params p
    JOIN simulation_artifact s ON s.id = p.simulation_id
),
-- Get simulation scenarios in order
simulation_scenarios AS (
    SELECT 
        ss.scenario_id,
        (SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) as position
    FROM params p
    JOIN simulation_scenarios ss ON ss.simulation_id = p.simulation_id 
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
          AND sfr.scenario_id = ss.scenario_id 
          AND f.name = 'simulation_active' 
          AND ssf.value = true)
    ORDER BY (SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
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
                FROM scenario_artifact s 
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
    -- Get first department FROM profile_artifact's accessible departments
    SELECT d.id as department_id
    FROM params p
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = p.profile_id 
      AND pd.active = true
    LIMIT 1
),
any_active_dept AS (
    -- Get any active department as last resort
    SELECT d.id as department_id
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
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
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
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
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE) 
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
            (SELECT id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
),
-- Document data for composite type aggregation
document_data AS (
    SELECT 
        s.id as scenario_id,
        d.id as document_id,
        (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        u.file_path,
        u.mime_type
    FROM scenario_artifact s
    CROSS JOIN chosen_scenario_id csi
    LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id AND sd.active = true
    LEFT JOIN documents_resource d ON d.id = sd.document_id
    LEFT JOIN document_uploads_resource dur ON dur.document_id = d.id AND dur.active = true
    LEFT JOIN uploads_resource ur ON ur.id = dur.uploads_id
    LEFT JOIN uploads_entry u ON u.id = ur.upload_id
    WHERE s.id = csi.scenario_id
),
-- Parameter item data for composite type aggregation
parameter_item_data AS (
    SELECT 
        s.id as scenario_id,
        f.id as field_id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p_param.id LIMIT 1) as parameter_name
    FROM scenario_artifact s
    CROSS JOIN chosen_scenario_id csi
    LEFT JOIN scenario_fields sf ON sf.scenario_id = s.id AND sf.active = true
    LEFT JOIN fields_resource f ON f.id = sf.field_id
    LEFT JOIN parameters_resource p_param ON p_param.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
    WHERE s.id = csi.scenario_id
),
-- Get full scenario data with all metadata
-- CRITICAL FIX: Use DISTINCT ON to ensure only ONE row per scenario
-- Multiple agents/models for the same persona can cause multiple rows, leading to duplicate chats_entry
scenario_full_data_raw AS (
    SELECT 
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as scenario_name,
        ps.problem_statement,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE) as active,
        false as generated,
        false as default_scenario,
        -- Persona data
        sp.persona_id::text as persona_id,
        (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = sp.persona_id LIMIT 1) as persona_name,
        COALESCE(
            pr_prompt_default.system_prompt,
            ''
        ) as system_prompt,
        COALESCE(tl.temperature, 0.0) as temperature,
        rl.reasoning_level as reasoning,
        (SELECT c.hex_code FROM persona_colors pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = sp.persona_id LIMIT 1) as persona_color,
        (SELECT i.name FROM persona_icons pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = sp.persona_id LIMIT 1) as persona_icon,
        -- Model data
        m.id as model_id,
        (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(e.base_url, '') as base_url,
        kr.key as api_key,
        -- Check if scenario needs generation
        CASE 
            WHEN ps.problem_statement IS NULL OR ps.problem_statement = '' THEN true
            ELSE false
        END as needs_generation
    FROM scenario_artifact s
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    CROSS JOIN chosen_scenario_id csi
    LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
    CROSS JOIN simulation_data sd_agents
    
    LEFT JOIN agents_resource a ON a.id = NULL::uuid AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    LEFT JOIN agent_models am ON am.agent_id = a.id
    LEFT JOIN models_resource m ON m.id = am.model_id
    -- Join temperature and reasoning FROM model_artifact levels via agent
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = m.id 
LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    -- IMPORTANT: Only join reasoning levels that belong to the agent's model (m.id = mrl.model_id)
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
    LEFT JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active
    WHERE s.id = csi.scenario_id
    GROUP BY s.id, (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), ps.problem_statement, EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE), 
             CASE WHEN ps.problem_statement IS NULL OR ps.problem_statement = '' THEN true ELSE false END, sp.persona_id, (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = sp.persona_id LIMIT 1), pr_prompt_default.system_prompt, 
             COALESCE(tl.temperature, 0.0), rl.reasoning_level, (SELECT c.hex_code FROM persona_colors pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = sp.persona_id LIMIT 1), (SELECT i.name FROM persona_icons pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = sp.persona_id LIMIT 1), m.id, (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1), n_prov.name,
             kr.key, e.base_url, act_s.settings_id
),
-- Select only ONE row per scenario (deterministic: pick first model by ID)
scenario_full_data AS (
    SELECT DISTINCT ON (scenario_id) *
    FROM scenario_full_data_raw
    ORDER BY scenario_id, model_id
),
-- Create group first (trace_id auto-generated by database default)
new_group AS (
    INSERT INTO groups_entry (created_at, updated_at)
    SELECT now(), now()
    FROM new_attempt na
    CROSS JOIN content_type_check ctc
    WHERE ctc.content_type = 'scenario'
    RETURNING id as group_id, trace_id, created_at, updated_at
),
-- Create simulation chat with group_id and attempt_id directly (only for scenarios, not videos)
new_chat AS (
    INSERT INTO chats_entry (
        created_at, title, scenario_id, completed, updated_at, group_id, attempt_id
    )
    SELECT
        ng.created_at,
        COALESCE(sfd.scenario_name, 'New Simulation'),
        sfd.scenario_id,
        false,
        ng.updated_at,
        ng.group_id,
        na.attempt_id
    FROM new_group ng
    CROSS JOIN scenario_full_data sfd
    CROSS JOIN new_attempt na
    RETURNING id as chat_id, title as chat_title, created_at, updated_at, group_id, attempt_id
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
LEFT JOIN new_chat nc ON ctc.content_type = 'scenario' AND nc.attempt_id = na.attempt_id
LEFT JOIN new_group ng ON ng.group_id = nc.group_id AND ctc.content_type = 'scenario'
LEFT JOIN scenario_full_data sfd ON ctc.content_type = 'scenario' AND sfd.scenario_id = (SELECT scenario_id FROM chosen_scenario_id)
$$;