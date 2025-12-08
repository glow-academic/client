-- Start simulation attempt: create attempt, link profile, select scenario, create chat
-- Parameters: $1=simulation_id (uuid), $2=infinite_mode (boolean), $3=profile_id (uuid, nullable), $4=scenario_id_override (uuid, nullable), $5=trace_id (text)
-- Returns: attempt_id, chat_id, chat_title, scenario_id, scenario_name, problem_statement, needs_generation, simulation_data (jsonb), scenario_metadata (jsonb)
WITH 
-- Create the attempt first
new_attempt AS (
    INSERT INTO simulation_attempts (simulation_id, infinite_mode, created_at)
    VALUES ($1::uuid, $2::bool, now())
    RETURNING id as attempt_id
),
-- Create attempt_profiles junction if profile exists
attempt_profile_link AS (
    INSERT INTO attempt_profiles (attempt_id, profile_id, active, created_at, updated_at)
    SELECT na.attempt_id, $3::uuid, true, now(), now()
    FROM new_attempt na
    WHERE $3::uuid IS NOT NULL
    RETURNING attempt_id
),
-- Get simulation data
simulation_data AS (
    SELECT 
        s.id,
        s.title,
        s.description,
        s.active,
        s.practice_simulation,
        (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id AND ss.active = true ORDER BY ss.position LIMIT 1) as rubric_id
    FROM simulations s
    WHERE s.id = $1::uuid
),
-- Get simulation scenarios in order
simulation_scenarios AS (
    SELECT 
        ss.scenario_id,
        ss.position
    FROM simulation_scenarios ss
    WHERE ss.simulation_id = $1::uuid AND ss.active = true
    ORDER BY ss.position
),
-- Get simulation videos in order
simulation_videos AS (
    SELECT 
        sv.video_id,
        sv.position
    FROM simulation_videos sv
    WHERE sv.simulation_id = $1::uuid AND sv.active = true
    ORDER BY sv.position
),
-- Determine content type and first content item
content_type_check AS (
    SELECT 
        CASE 
            -- If scenario override provided, use scenario
            WHEN COALESCE($4::text, '') != '' THEN 'scenario'
            -- Compare positions: use whichever comes first (scenario or video)
            WHEN EXISTS(SELECT 1 FROM simulation_scenarios) AND EXISTS(SELECT 1 FROM simulation_videos) THEN
                CASE 
                    WHEN (SELECT MIN(position) FROM simulation_scenarios) < 
                         (SELECT MIN(position) FROM simulation_videos) THEN 'scenario'
                    ELSE 'video'
                END
            -- If only scenarios exist, use scenario
            WHEN EXISTS(SELECT 1 FROM simulation_scenarios) THEN 'scenario'
            -- If only videos exist, use video
            WHEN EXISTS(SELECT 1 FROM simulation_videos) THEN 'video'
            -- Default to scenario
            ELSE 'scenario'
        END as content_type,
        CASE 
            -- If content type is video, get first video_id
            WHEN (CASE 
                    WHEN COALESCE($4::text, '') != '' THEN 'scenario'
                    WHEN EXISTS(SELECT 1 FROM simulation_scenarios) AND EXISTS(SELECT 1 FROM simulation_videos) THEN
                        CASE 
                            WHEN (SELECT MIN(position) FROM simulation_scenarios) < 
                                 (SELECT MIN(position) FROM simulation_videos) THEN 'scenario'
                            ELSE 'video'
                        END
                    WHEN EXISTS(SELECT 1 FROM simulation_scenarios) THEN 'scenario'
                    WHEN EXISTS(SELECT 1 FROM simulation_videos) THEN 'video'
                    ELSE 'scenario'
                  END) = 'video' THEN
                (SELECT video_id FROM simulation_videos ORDER BY position LIMIT 1)
            ELSE NULL::uuid
        END as first_video_id
),
-- Determine chosen scenario
chosen_scenario_id AS (
    SELECT 
        CASE 
            WHEN COALESCE($4::text, '') != '' THEN $4::uuid  -- scenario_id_override
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
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = $3::uuid 
      AND pd.active = true 
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
    -- Get profile's primary department ID (only if profile_id is provided)
    SELECT pd.department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $3::uuid 
      AND pd.is_primary = TRUE 
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
active_settings AS (
    -- For authenticated users: prefer department-specific, then default, then any active
    -- For NULL profile_id: use default settings
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
),
-- Get full scenario data with all metadata
-- CRITICAL FIX: Use DISTINCT ON to ensure only ONE row per scenario
-- Multiple agents/models for the same persona can cause multiple rows, leading to duplicate chats
scenario_full_data_raw AS (
    SELECT 
        s.id as scenario_id,
        s.name as scenario_name,
        ps.problem_statement,
        s.active,
        s.generated,
        false as default_scenario,
        -- Persona data
        p.id as persona_id,
        p.name as persona_name,
        COALESCE(
            COALESCE(pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt),
            ''
        ) as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        p.color as persona_color,
        p.icon as persona_icon,
        -- Model data
        m.id as model_id,
        m.value as model_name,
        COALESCE(p_prov.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        -- Documents (aggregated)
        COALESCE(
            json_agg(
                json_build_object(
                    'id', d.id::text,
                    'name', d.name,
                    'file_path', u.file_path,
                    'mime_type', u.mime_type
                ) ORDER BY d.id
            ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true),
            '[]'::json
        ) as documents,
        -- Parameter items (aggregated)
        COALESCE(
            json_agg(
                json_build_object(
                    'id', f.id::text,
                    'name', f.name,
                    'description', f.description,
                    'parameter_id', fp.parameter_id::text,
                    'parameter_name', p_param.name
                ) ORDER BY f.id
            ) FILTER (WHERE f.id IS NOT NULL AND sf.active = true),
            '[]'::json
        ) as parameter_items,
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
    LEFT JOIN persona_text_agents pta ON pta.persona_id = p.id AND pta.active = true
    LEFT JOIN agents a ON a.id = pta.agent_id
    LEFT JOIN models m ON m.id = a.model_id
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
    LEFT JOIN providers p_prov ON p_prov.id = m.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
    LEFT JOIN documents d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    LEFT JOIN scenario_fields sf ON sf.scenario_id = s.id
    LEFT JOIN fields f ON f.id = sf.field_id
    LEFT JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    LEFT JOIN parameters p_param ON p_param.id = fp.parameter_id
    WHERE s.id = csi.scenario_id
    GROUP BY s.id, s.name, ps.problem_statement, s.active, 
             s.generated, p.id, p.name, pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt, 
             COALESCE(mtl.temperature, 0.0), mrl.reasoning_level, p.color, p.icon, m.id, m.value, p_prov.value,
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
        created_at, title, scenario_id, completed, trace_id, updated_at
    )
    SELECT 
        now(),
        COALESCE(sfd.scenario_name, 'New Simulation'),
        sfd.scenario_id,
        false,
        $5::text,
        now()
    FROM new_attempt na
    CROSS JOIN scenario_full_data sfd
    CROSS JOIN content_type_check ctc
    WHERE ctc.content_type = 'scenario'
    RETURNING id as chat_id, title as chat_title, created_at, updated_at
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
    ctc.first_video_id::text as video_id,
    -- Simulation metadata as JSONB
    jsonb_build_object(
        'id', sd.id::text,
        'title', sd.title,
        'description', sd.description,
        'active', sd.active,
        'practice_simulation', sd.practice_simulation,
        'rubric_id', sd.rubric_id::text
    ) as simulation_data,
    -- Scenario metadata as JSONB (only for scenarios)
    CASE 
        WHEN ctc.content_type = 'scenario' THEN
            jsonb_build_object(
                'persona_id', sfd.persona_id::text,
                'persona_name', sfd.persona_name,
                'persona_system_prompt', sfd.system_prompt,
                'persona_temperature', sfd.temperature,
                'persona_reasoning', sfd.reasoning,
                'persona_color', sfd.persona_color,
                'persona_icon', sfd.persona_icon,
                'model_id', sfd.model_id::text,
                'model_name', sfd.model_name,
                'provider', sfd.provider,
                'provider_base_url', sfd.base_url,
                'provider_api_key', sfd.api_key,
                'documents', sfd.documents,
                'parameter_items', sfd.parameter_items,
                'active', sfd.active,
                'default_scenario', sfd.default_scenario,
                'generated', sfd.generated
            )
        ELSE NULL::jsonb
    END as scenario_metadata
FROM new_attempt na
CROSS JOIN content_type_check ctc
CROSS JOIN simulation_data sd
LEFT JOIN new_chat nc ON ctc.content_type = 'scenario'
LEFT JOIN attempt_chat_link acl ON acl.chat_id = nc.chat_id AND acl.attempt_id = na.attempt_id AND ctc.content_type = 'scenario'
LEFT JOIN scenario_full_data sfd ON ctc.content_type = 'scenario' AND sfd.scenario_id = (SELECT scenario_id FROM chosen_scenario_id)

