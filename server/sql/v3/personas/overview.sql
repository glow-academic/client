-- Get persona overview with scenarios
-- Params: $1 = persona_id
SELECT 
    p.id, p.name, p.description, COALESCE(pr.system_prompt, '') as system_prompt, COALESCE(mtl.temperature, 0.0) as temperature, 
    p.created_at, p.updated_at,
    COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'problem_statement', COALESCE(ps.problem_statement, ''),
            'default_scenario', s.default_scenario,
            'created_at', s.created_at
        )) FILTER (WHERE s.id IS NOT NULL),
        '[]'::jsonb
    ) as scenarios
FROM personas p
LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
LEFT JOIN prompts pr ON pr.id = pp.prompt_id
-- Note: Personas no longer have agents after migration 97, temperature defaults to 0.0
LEFT JOIN scenario_personas sp ON sp.persona_id = p.id AND sp.active = true
LEFT JOIN scenarios s ON s.id = sp.scenario_id
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
WHERE p.id = $1
GROUP BY p.id, p.name, p.description, pr.system_prompt, 
         p.created_at, p.updated_at;

