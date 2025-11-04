SELECT 
    p.name,
    p.description,
    COALESCE(pr.system_prompt, '') as system_prompt,
    p.temperature,
    p.reasoning,
    p.model_id,
    p.color,
    p.icon
FROM personas p
LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
LEFT JOIN prompts pr ON pr.id = pp.prompt_id
WHERE p.id = $1

