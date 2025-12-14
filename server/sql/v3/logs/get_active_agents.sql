-- Get first active simulation agent with provider credentials
-- Updated after migration 97: agents are now on simulations (simulation_text_agent_id)
WITH default_settings AS (
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
active_settings AS (
    -- Use default settings, fall back to any active settings
    SELECT 
        COALESCE(
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
)
SELECT 
    a.id::text as id, 
    a.name, 
    COALESCE(pr_prompt.system_prompt, '') as system_prompt, 
    COALESCE(mtl.temperature, 0.0) as temperature,
    COALESCE(p_prov.value::text, '') as provider_name, 
    k.key as api_key,
    COALESCE(me.base_url, '') as base_url, 
    m.value as model_name,
    mrl.reasoning_level as reasoning,
    'simulation' as agent_type
FROM simulations sim
INNER JOIN agents a ON a.id = sim.simulation_text_agent_id AND a.active = true
LEFT JOIN models m ON m.id = a.model_id
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
-- IMPORTANT: Only join reasoning levels that belong to the agent's model (m.id = mrl.model_id)
LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
-- Get keys via settings system: provider -> active settings -> setting_provider_keys
LEFT JOIN providers p_prov ON p_prov.id = m.provider_id
CROSS JOIN active_settings act_s
LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
    AND spk.settings_id = act_s.settings_id 
    AND spk.active = true
LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
LEFT JOIN prompts pr_prompt ON pr_prompt.id = ap.prompt_id
WHERE sim.active = true
LIMIT 1

