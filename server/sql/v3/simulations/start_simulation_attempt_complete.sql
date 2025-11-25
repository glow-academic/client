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
-- Get full scenario data with all metadata
scenario_full_data AS (
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
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        p.temperature,
        p.reasoning,
        p.color as persona_color,
        p.icon as persona_icon,
        -- Model data
        m.id as model_id,
        m.name as model_name,
        m.provider::text as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        -- Documents (aggregated)
        COALESCE(
            json_agg(
                json_build_object(
                    'id', d.id::text,
                    'name', d.name,
                    'file_path', d.file_path,
                    'mime_type', d.mime_type
                ) ORDER BY d.id
            ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true),
            '[]'::json
        ) as documents,
        -- Parameter items (aggregated)
        COALESCE(
            json_agg(
                json_build_object(
                    'id', pi.id::text,
                    'name', pi.name,
                    'description', pi.description,
                    'parameter_id', pi.parameter_id::text,
                    'parameter_name', p_param.name
                ) ORDER BY pi.id
            ) FILTER (WHERE pi.id IS NOT NULL AND spi.active = true),
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
    LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = pp.prompt_id
    LEFT JOIN persona_text_model ptm ON ptm.persona_id = p.id AND ptm.active = true
    LEFT JOIN models m ON m.id = ptm.model_id
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
    LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true AND k.type = 'api'
    LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
    LEFT JOIN documents d ON d.id = sd.document_id
    LEFT JOIN scenario_parameter_items spi ON spi.scenario_id = s.id
    LEFT JOIN parameter_items pi ON pi.id = spi.parameter_item_id
    LEFT JOIN parameters p_param ON p_param.id = pi.parameter_id
    WHERE s.id = csi.scenario_id
    GROUP BY s.id, s.name, ps.problem_statement, s.active, 
             s.generated, p.id, p.name, pr_prompt.system_prompt, 
             p.temperature, p.reasoning, p.color, p.icon, m.id, m.name, m.provider,
             k.key, me.base_url
),
-- Create simulation chat (without attempt_id - uses junction table)
new_chat AS (
    INSERT INTO simulation_chats (
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
    RETURNING id as chat_id, title as chat_title, created_at, updated_at
),
-- Create attempt_chats junction table entry
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
    nc.chat_id::text,
    nc.chat_title,
    sfd.scenario_id::text,
    sfd.scenario_name,
    sfd.problem_statement,
    sfd.needs_generation,
    -- Simulation metadata as JSONB
    jsonb_build_object(
        'id', sd.id::text,
        'title', sd.title,
        'description', sd.description,
        'active', sd.active,
        'practice_simulation', sd.practice_simulation,
        'rubric_id', sd.rubric_id::text
    ) as simulation_data,
    -- Scenario metadata as JSONB
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
    ) as scenario_metadata
FROM new_attempt na
CROSS JOIN new_chat nc
INNER JOIN attempt_chat_link acl ON acl.chat_id = nc.chat_id AND acl.attempt_id = na.attempt_id
CROSS JOIN scenario_full_data sfd
CROSS JOIN simulation_data sd

