-- Get first active assistant agent with provider credentials
-- Assistants are agents with role='assistant' in the agents table
SELECT 
    a.id, 
    a.name, 
    COALESCE(pr_prompt.system_prompt, '') as system_prompt, 
    a.temperature,
    p.name as provider_name, 
    p.api_key,
    pe.base_url, 
    m.name as model_name,
    m.custom_model, 
    a.reasoning
FROM agents a
JOIN models m ON a.model_id = m.id
JOIN providers p ON m.provider_id = p.id
LEFT JOIN provider_endpoints pe ON p.id = pe.provider_id
LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
LEFT JOIN prompts pr_prompt ON pr_prompt.id = ap.prompt_id
WHERE a.role = 'assistant' AND a.active = true
LIMIT 1

