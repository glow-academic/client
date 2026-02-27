-- Duplicate agent with profile_id for auditing
-- Converted to function

-- Create function
CREATE OR REPLACE FUNCTION api_duplicate_agent_v4(
    agent_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    agent_id text,
    agent_name text,
    actor_name text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT agent_id AS agent_id,
           profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        x.profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
source_agent AS (
    SELECT 
        a.id as source_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        (SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1),
        (SELECT m.id FROM agent_models_junction am JOIN models_resource m ON am.model_id = m.id WHERE am.agent_id = a.id LIMIT 1) as model_id,
        COALESCE(NULL::artifact_type::text, '') as role,  -- Derive from agent_artifact's tools via inline resource map
        ap.prompt_id,
        COALESCE(pr.system_prompt, '') as system_prompt,
        -- Get temperature and reasoning from junction tables
        atl.temperature_level_id,
        arl.reasoning_level_id,
        NULL::artifact_type  -- Need artifact for linking
    FROM params x
    JOIN agents_resource a ON a.id = x.agent_id
    LEFT JOIN LATERAL (
        SELECT DISTINCT ar.artifact::text
        FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_resources_junction tdj ON tdj.tool_id = ttj.tool_id AND tdj.active = true
        JOIN resources_resource dr ON dr.id = tdj.resource_id AND dr.active = true
        JOIN (VALUES
            ('agent'::artifact_type, 'agents'::resource_type),
            ('agent'::artifact_type, 'departments'::resource_type),
            ('agent'::artifact_type, 'descriptions'::resource_type),
            ('agent'::artifact_type, 'flags'::resource_type),
            ('agent'::artifact_type, 'instructions'::resource_type),
            ('agent'::artifact_type, 'models'::resource_type),
            ('agent'::artifact_type, 'names'::resource_type),
            ('agent'::artifact_type, 'prompts'::resource_type),
            ('agent'::artifact_type, 'reasoning_levels'::resource_type),
            ('agent'::artifact_type, 'temperature_levels'::resource_type),
            ('agent'::artifact_type, 'tools'::resource_type),
            ('agent'::artifact_type, 'voices'::resource_type),
            ('auth'::artifact_type, 'auths'::resource_type),
            ('auth'::artifact_type, 'departments'::resource_type),
            ('auth'::artifact_type, 'descriptions'::resource_type),
            ('auth'::artifact_type, 'flags'::resource_type),
            ('auth'::artifact_type, 'items'::resource_type),
            ('auth'::artifact_type, 'names'::resource_type),
            ('auth'::artifact_type, 'protocols'::resource_type),
            ('auth'::artifact_type, 'slugs'::resource_type),
            ('cohort'::artifact_type, 'cohorts'::resource_type),
            ('cohort'::artifact_type, 'departments'::resource_type),
            ('cohort'::artifact_type, 'descriptions'::resource_type),
            ('cohort'::artifact_type, 'flags'::resource_type),
            ('cohort'::artifact_type, 'names'::resource_type),
            ('cohort'::artifact_type, 'simulation_positions'::resource_type),
            ('cohort'::artifact_type, 'simulations'::resource_type),
            ('department'::artifact_type, 'departments'::resource_type),
            ('department'::artifact_type, 'descriptions'::resource_type),
            ('department'::artifact_type, 'flags'::resource_type),
            ('department'::artifact_type, 'names'::resource_type),
            ('department'::artifact_type, 'settings'::resource_type),
            ('document'::artifact_type, 'departments'::resource_type),
            ('document'::artifact_type, 'descriptions'::resource_type),
            ('document'::artifact_type, 'documents'::resource_type),
            ('document'::artifact_type, 'flags'::resource_type),
            ('document'::artifact_type, 'names'::resource_type),
            ('document'::artifact_type, 'parameter_fields'::resource_type),
            ('document'::artifact_type, 'parameters'::resource_type),
            ('eval'::artifact_type, 'departments'::resource_type),
            ('eval'::artifact_type, 'descriptions'::resource_type),
            ('eval'::artifact_type, 'evals'::resource_type),
            ('eval'::artifact_type, 'flags'::resource_type),
            ('eval'::artifact_type, 'group_positions'::resource_type),
            ('eval'::artifact_type, 'groups'::resource_type),
            ('eval'::artifact_type, 'names'::resource_type),
            ('eval'::artifact_type, 'run_positions'::resource_type),
            ('eval'::artifact_type, 'runs'::resource_type),
            ('field'::artifact_type, 'conditional_parameters'::resource_type),
            ('field'::artifact_type, 'departments'::resource_type),
            ('field'::artifact_type, 'descriptions'::resource_type),
            ('field'::artifact_type, 'fields'::resource_type),
            ('field'::artifact_type, 'flags'::resource_type),
            ('field'::artifact_type, 'names'::resource_type),
            ('model'::artifact_type, 'departments'::resource_type),
            ('model'::artifact_type, 'descriptions'::resource_type),
            ('model'::artifact_type, 'flags'::resource_type),
            ('model'::artifact_type, 'modalities'::resource_type),
            ('model'::artifact_type, 'models'::resource_type),
            ('model'::artifact_type, 'names'::resource_type),
            ('model'::artifact_type, 'pricing'::resource_type),
            ('model'::artifact_type, 'providers'::resource_type),
            ('model'::artifact_type, 'qualities'::resource_type),
            ('model'::artifact_type, 'reasoning_levels'::resource_type),
            ('model'::artifact_type, 'temperature_levels'::resource_type),
            ('model'::artifact_type, 'values'::resource_type),
            ('model'::artifact_type, 'voices'::resource_type),
            ('parameter'::artifact_type, 'departments'::resource_type),
            ('parameter'::artifact_type, 'descriptions'::resource_type),
            ('parameter'::artifact_type, 'fields'::resource_type),
            ('parameter'::artifact_type, 'flags'::resource_type),
            ('parameter'::artifact_type, 'names'::resource_type),
            ('parameter'::artifact_type, 'parameters'::resource_type),
            ('persona'::artifact_type, 'colors'::resource_type),
            ('persona'::artifact_type, 'departments'::resource_type),
            ('persona'::artifact_type, 'descriptions'::resource_type),
            ('persona'::artifact_type, 'examples'::resource_type),
            ('persona'::artifact_type, 'flags'::resource_type),
            ('persona'::artifact_type, 'icons'::resource_type),
            ('persona'::artifact_type, 'instructions'::resource_type),
            ('persona'::artifact_type, 'names'::resource_type),
            ('persona'::artifact_type, 'parameter_fields'::resource_type),
            ('persona'::artifact_type, 'parameters'::resource_type),
            ('persona'::artifact_type, 'personas'::resource_type),
            ('profile'::artifact_type, 'cohorts'::resource_type),
            ('profile'::artifact_type, 'departments'::resource_type),
            ('profile'::artifact_type, 'emails'::resource_type),
            ('profile'::artifact_type, 'flags'::resource_type),
            ('profile'::artifact_type, 'names'::resource_type),
            ('profile'::artifact_type, 'profiles'::resource_type),
            ('profile'::artifact_type, 'request_limits'::resource_type),
            ('profile'::artifact_type, 'roles'::resource_type),
            ('profile'::artifact_type, 'routes'::resource_type),
            ('provider'::artifact_type, 'departments'::resource_type),
            ('provider'::artifact_type, 'descriptions'::resource_type),
            ('provider'::artifact_type, 'endpoints'::resource_type),
            ('provider'::artifact_type, 'flags'::resource_type),
            ('provider'::artifact_type, 'keys'::resource_type),
            ('provider'::artifact_type, 'names'::resource_type),
            ('provider'::artifact_type, 'providers'::resource_type),
            ('provider'::artifact_type, 'values'::resource_type),
            ('rubric'::artifact_type, 'departments'::resource_type),
            ('rubric'::artifact_type, 'descriptions'::resource_type),
            ('rubric'::artifact_type, 'flags'::resource_type),
            ('rubric'::artifact_type, 'names'::resource_type),
            ('rubric'::artifact_type, 'points'::resource_type),
            ('rubric'::artifact_type, 'rubrics'::resource_type),
            ('rubric'::artifact_type, 'standard_groups'::resource_type),
            ('rubric'::artifact_type, 'standards'::resource_type),
            ('scenario'::artifact_type, 'departments'::resource_type),
            ('scenario'::artifact_type, 'descriptions'::resource_type),
            ('scenario'::artifact_type, 'documents'::resource_type),
            ('scenario'::artifact_type, 'flags'::resource_type),
            ('scenario'::artifact_type, 'images'::resource_type),
            ('scenario'::artifact_type, 'names'::resource_type),
            ('scenario'::artifact_type, 'objectives'::resource_type),
            ('scenario'::artifact_type, 'options'::resource_type),
            ('scenario'::artifact_type, 'parameter_fields'::resource_type),
            ('scenario'::artifact_type, 'parameters'::resource_type),
            ('scenario'::artifact_type, 'personas'::resource_type),
            ('scenario'::artifact_type, 'problem_statements'::resource_type),
            ('scenario'::artifact_type, 'questions'::resource_type),
            ('scenario'::artifact_type, 'scenarios'::resource_type),
            ('scenario'::artifact_type, 'videos'::resource_type),
            ('setting'::artifact_type, 'agents'::resource_type),
            ('setting'::artifact_type, 'auth_item_keys'::resource_type),
            ('setting'::artifact_type, 'auths'::resource_type),
            ('setting'::artifact_type, 'colors'::resource_type),
            ('setting'::artifact_type, 'departments'::resource_type),
            ('setting'::artifact_type, 'descriptions'::resource_type),
            ('setting'::artifact_type, 'flags'::resource_type),
            ('setting'::artifact_type, 'names'::resource_type),
            ('setting'::artifact_type, 'profiles'::resource_type),
            ('setting'::artifact_type, 'provider_keys'::resource_type),
            ('setting'::artifact_type, 'role_routes'::resource_type),
            ('setting'::artifact_type, 'roles'::resource_type),
            ('setting'::artifact_type, 'settings'::resource_type),
            ('setting'::artifact_type, 'thresholds'::resource_type),
            ('simulation'::artifact_type, 'departments'::resource_type),
            ('simulation'::artifact_type, 'descriptions'::resource_type),
            ('simulation'::artifact_type, 'flags'::resource_type),
            ('simulation'::artifact_type, 'names'::resource_type),
            ('simulation'::artifact_type, 'scenario_flags'::resource_type),
            ('simulation'::artifact_type, 'scenario_personas'::resource_type),
            ('simulation'::artifact_type, 'scenario_positions'::resource_type),
            ('simulation'::artifact_type, 'scenario_rubrics'::resource_type),
            ('simulation'::artifact_type, 'scenario_time_limits'::resource_type),
            ('simulation'::artifact_type, 'scenarios'::resource_type),
            ('simulation'::artifact_type, 'simulations'::resource_type),
            ('tool'::artifact_type, 'arg_positions'::resource_type),
            ('tool'::artifact_type, 'args'::resource_type),
            ('tool'::artifact_type, 'args_outputs'::resource_type),
            ('tool'::artifact_type, 'bindings'::resource_type),
            ('tool'::artifact_type, 'departments'::resource_type),
            ('tool'::artifact_type, 'descriptions'::resource_type),
            ('tool'::artifact_type, 'domains'::resource_type),
            ('tool'::artifact_type, 'flags'::resource_type),
            ('tool'::artifact_type, 'names'::resource_type),
            ('tool'::artifact_type, 'tools'::resource_type)
        ) AS ar(artifact, resource) ON ar.resource = dr.resource
        WHERE at.agent_id = a.id AND at.active = TRUE
        LIMIT 1
    ) da ON TRUE
    LEFT JOIN agent_prompts_junction ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts_resource pr ON pr.id = ap.prompt_id
    LEFT JOIN agent_temperature_levels_junction atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN agent_reasoning_levels_junction arl ON arl.agent_id = a.id AND arl.active = true
),
new_prompt AS (
    INSERT INTO prompts_resource (name, description, system_prompt, created_at)
    SELECT 
        COALESCE(pr.name, 'Agent Prompt') || ' Copy',
        COALESCE(pr.description, ''),
        sa.system_prompt, 
        NOW()
    FROM source_agent sa
    LEFT JOIN prompts_resource pr ON pr.id = sa.prompt_id
    RETURNING id as prompt_id
),
-- Insert name INTO names_resource table and get ID
name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT sa.name || ' Copy', NOW()
    FROM source_agent sa
    WHERE sa.name IS NOT NULL AND sa.name != ''
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table and get ID
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT sa.description, NOW()
    FROM source_agent sa
    WHERE sa.description IS NOT NULL AND sa.description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as description_id
),
new_agent AS (
    -- Create agent (without name/description/model_id/active columns)
    INSERT INTO agent_artifact (created_at, updated_at)
    SELECT 
        NOW(),
        NOW()
    FROM source_agent sa
    RETURNING id::text as agent_id
),
-- Link agent to name
link_agent_name AS (
    INSERT INTO agent_names_junction (agent_id, name_id, created_at)
    SELECT 
        na.agent_id::uuid,
        nr.name_id,
        NOW()
    FROM new_agent na
    CROSS JOIN name_resource nr
    ON CONFLICT (agent_id, name_id) DO NOTHING
),
-- Link agent to description
link_agent_description AS (
    INSERT INTO agent_descriptions_junction (agent_id, description_id, created_at)
    SELECT 
        na.agent_id::uuid,
        dr.description_id,
        NOW()
    FROM new_agent na
    CROSS JOIN description_resource dr
    ON CONFLICT (agent_id, description_id) DO NOTHING
),
-- Link agent to model
link_agent_model AS (
    INSERT INTO agent_models_junction (agent_id, model_id, created_at)
    SELECT 
        na.agent_id::uuid,
        sa.model_id,
        NOW()
    FROM new_agent na
    CROSS JOIN source_agent sa
    WHERE sa.model_id IS NOT NULL
    ON CONFLICT (agent_id, model_id) DO NOTHING
),
-- Link agent active flag (defaults to false)
link_agent_active_flag AS (
    INSERT INTO agent_flags_junction (agent_id, flag_id, value, created_at) SELECT na.agent_id::uuid,
        f.id,
        false,
        NOW()
    FROM new_agent na
    CROSS JOIN flags_resource f
    WHERE f.name = 'agent_active'
    ON CONFLICT (agent_id, flag_id) DO UPDATE SET 
        value = false
),
copy_temperature AS (
    INSERT INTO agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at)
    SELECT 
        na.agent_id::uuid,
        sa.temperature_level_id,
        true,
        NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    WHERE sa.temperature_level_id IS NOT NULL
),
copy_reasoning AS (
    INSERT INTO agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at)
    SELECT 
        na.agent_id::uuid,
        sa.reasoning_level_id,
        true,
        NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    WHERE sa.reasoning_level_id IS NOT NULL
),
link_prompt AS (
    INSERT INTO agent_prompts_junction (agent_id, prompt_id, active, created_at)
    SELECT na.agent_id::uuid, np.prompt_id, true, NOW()
    FROM new_agent na
    CROSS JOIN new_prompt np
),
copy_departments AS (
    INSERT INTO agent_departments_junction (agent_id, department_id, active, created_at)
    SELECT 
        na.agent_id::uuid,
        ad.department_id,
        ad.active,
        NOW()
    FROM source_agent sa
    JOIN agent_departments_junction ad ON NULL::uuid = sa.source_id AND ad.active = true
    CROSS JOIN new_agent na
)
SELECT 
    na.agent_id,
    sa.name as agent_name,
    ap.actor_name
FROM new_agent na
CROSS JOIN source_agent sa
CROSS JOIN actor_profile ap
$$;
