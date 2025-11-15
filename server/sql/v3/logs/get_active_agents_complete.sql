-- Get active simulation and assistant agents in single query
-- Returns: simulation_agent (jsonb), assistant_agent (jsonb)

WITH simulation_agent AS (
    SELECT 
        jsonb_build_object(
            'id', p.id::text,
            'name', p.name,
            'system_prompt', COALESCE(pr_prompt.system_prompt, ''),
            'temperature', p.temperature,
            'provider_name', pr.name,
            'api_key', pr.api_key,
            'base_url', pe.base_url,
            'model_name', m.name,
            'custom_model', m.custom_model,
            'reasoning', p.reasoning
        ) as agent_data
    FROM personas p
    JOIN models m ON p.model_id = m.id
    JOIN providers pr ON m.provider_id = pr.id
    LEFT JOIN provider_endpoints pe ON pr.id = pe.provider_id
    LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = pp.prompt_id
    WHERE p.active = true
    LIMIT 1
),
assistant_agent AS (
    SELECT 
        jsonb_build_object(
            'id', a.id::text,
            'name', a.name,
            'system_prompt', COALESCE(pr_prompt.system_prompt, ''),
            'temperature', a.temperature,
            'provider_name', p.name,
            'api_key', p.api_key,
            'base_url', pe.base_url,
            'model_name', m.name,
            'custom_model', m.custom_model,
            'reasoning', a.reasoning
        ) as agent_data
    FROM agents a
    JOIN models m ON a.model_id = m.id
    JOIN providers p ON m.provider_id = p.id
    LEFT JOIN provider_endpoints pe ON p.id = pe.provider_id
    LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = ap.prompt_id
    WHERE a.role = 'assistant' AND a.active = true
    LIMIT 1
)
SELECT 
    (SELECT agent_data FROM simulation_agent LIMIT 1) as simulation_agent,
    (SELECT agent_data FROM assistant_agent LIMIT 1) as assistant_agent

