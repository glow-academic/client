-- Get scenario overview with simulations and persona IDs
-- Params: $1 = scenario_id
SELECT 
    s.id, s.name, ps.problem_statement, 
    s.created_at, s.updated_at,
    COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
            'id', sim.id,
            'title', sim.title,
            'active', sim.active,
            'time_limit', sim.time_limit,
            'created_at', sim.created_at
        )) FILTER (WHERE sim.id IS NOT NULL),
        '[]'::jsonb
    ) as simulations,
    COALESCE((
        SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id)
        FROM scenario_personas 
        WHERE scenario_id = s.id AND active = true
    ), ARRAY[]::text[]) as persona_ids
FROM scenarios s
LEFT JOIN scenario_problem_statements sps_j ON sps_j.scenario_id = s.id AND sps_j.active = true
LEFT JOIN problem_statements ps ON ps.id = sps_j.problem_statement_id
LEFT JOIN simulation_scenarios ss ON ss.scenario_id = s.id
LEFT JOIN simulations sim ON sim.id = ss.simulation_id
WHERE s.id = $1
GROUP BY s.id, s.name, ps.problem_statement, 
         s.created_at, s.updated_at;

