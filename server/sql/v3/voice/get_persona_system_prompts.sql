-- Get full system prompts (agent prompt + persona instructions) for all personas in a chat
-- Parameters: $1=chat_id (uuid), $2=department_id (uuid)
-- Returns: persona_id, persona_name, system_prompt for each persona
-- System prompt = agent_prompt (department-specific or default) + '\n\n' + persona.instructions
WITH chat_info AS (
    SELECT 
        c.id as chat_id,
        COALESCE(
            $2::uuid,
            (SELECT sd.department_id FROM scenario_departments sd 
             WHERE sd.scenario_id = c.scenario_id AND sd.active = true LIMIT 1),
            (SELECT pd.department_id FROM profile_departments pd
             JOIN attempt_profiles ap ON ap.profile_id = pd.profile_id
             JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id
             WHERE ac.chat_id = c.id AND ap.active = true AND pd.active = true LIMIT 1),
            (SELECT id FROM departments WHERE active = true LIMIT 1)
        ) as department_id
    FROM chats c
    WHERE c.id = $1::uuid
)
SELECT 
    p.id::text as persona_id,
    p.name as persona_name,
    CASE 
        WHEN p.instructions IS NOT NULL AND p.instructions != '' THEN
            COALESCE(pr_dept.system_prompt, pr_default.system_prompt) || E'\n\n' || p.instructions
        ELSE
            COALESCE(pr_dept.system_prompt, pr_default.system_prompt)
    END as system_prompt
FROM chat_info ci
JOIN chats c ON c.id = ci.chat_id
JOIN scenario_personas sp ON sp.scenario_id = c.scenario_id AND sp.active = true
JOIN personas p ON p.id = sp.persona_id AND p.active = true
-- Get voice agent for this persona
JOIN persona_voice_agents pva ON pva.persona_id = p.id AND pva.active = true
JOIN agents a ON a.id = pva.agent_id AND a.active = true
-- Get department-specific prompt (if exists)
LEFT JOIN agent_department_prompts adp ON adp.agent_id = a.id 
    AND adp.department_id = ci.department_id
    AND adp.active = true
LEFT JOIN prompts pr_dept ON pr_dept.id = adp.prompt_id AND pr_dept.active = true
-- Get default prompt (if no department-specific)
LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
LEFT JOIN prompts pr_default ON pr_default.id = ap.prompt_id AND pr_default.active = true
WHERE COALESCE(pr_dept.system_prompt, pr_default.system_prompt) IS NOT NULL
  AND COALESCE(pr_dept.system_prompt, pr_default.system_prompt) != ''
ORDER BY p.name

