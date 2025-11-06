-- Get first active simulation persona with provider credentials
-- Simulations use personas, not agents directly
SELECT 
    p.id, 
    p.name, 
    COALESCE(pr_prompt.system_prompt, '') as system_prompt, 
    p.temperature,
    pr.name as provider_name, 
    pr.api_key,
    pe.base_url, 
    m.name as model_name,
    m.custom_model, 
    p.reasoning
FROM personas p
JOIN models m ON p.model_id = m.id
JOIN providers pr ON m.provider_id = pr.id
LEFT JOIN provider_endpoints pe ON pr.id = pe.provider_id
LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
LEFT JOIN prompts pr_prompt ON pr_prompt.id = pp.prompt_id
WHERE p.active = true
LIMIT 1

