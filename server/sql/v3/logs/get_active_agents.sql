-- Get first active simulation persona with provider credentials
SELECT 
    p.id, 
    p.name, 
    COALESCE(pr_prompt.system_prompt, '') as system_prompt, 
    p.temperature,
    m.provider::text as provider_name, 
    k.key as api_key,
    COALESCE(me.base_url, '') as base_url, 
    m.name as model_name,
    p.reasoning,
    'simulation' as agent_type
FROM personas p
JOIN persona_text_model ptm ON ptm.persona_id = p.id AND ptm.active = true
JOIN models m ON m.id = ptm.model_id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true AND k.type = 'api'
LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
LEFT JOIN prompts pr_prompt ON pr_prompt.id = pp.prompt_id
WHERE p.active = true
LIMIT 1

