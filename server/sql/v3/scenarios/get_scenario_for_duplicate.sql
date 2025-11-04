SELECT 
    s.name,
    s.active,
    sps.problem_statement,
    s.hints_enabled,
    s.objectives_enabled,
    s.image_input_enabled,
    s.copy_paste_allowed,
    s.input_guardrail_enabled,
    s.output_guardrail_enabled
FROM scenarios s
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
WHERE s.id = $1

