-- Get first active simulation persona with provider credentials
SELECT 
    p.id, 
    p.name, 
    COALESCE(pr_prompt.system_prompt, '') as system_prompt, 
    COALESCE(mtl.temperature, 0.0) as temperature,
    m.provider::text as provider_name, 
    k.key as api_key,
    COALESCE(me.base_url, '') as base_url, 
    m.name as model_name,
    mrl.reasoning_level as reasoning,
    'simulation' as agent_type
FROM personas p
LEFT JOIN persona_text_agents pta ON pta.persona_id = p.id AND pta.active = true
LEFT JOIN agents a ON a.id = pta.agent_id
LEFT JOIN models m ON m.id = a.model_id
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
-- IMPORTANT: Only join reasoning levels that belong to the agent's model (m.id = mrl.model_id)
LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true
LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
LEFT JOIN prompts pr_prompt ON pr_prompt.id = pp.prompt_id
WHERE p.active = true
LIMIT 1

