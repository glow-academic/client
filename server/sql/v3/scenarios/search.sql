-- Search scenarios by name or problem statement
-- Params: $1 = query pattern (with % wildcards), $2 = limit
SELECT 
    s.id,
    s.name,
    sps.problem_statement,
    COALESCE((
        SELECT persona_id::text
        FROM scenario_personas 
        WHERE scenario_id = s.id AND active = true 
        LIMIT 1
    ), NULL) as persona_id,
    s.default_scenario,
    CASE 
        WHEN LOWER(s.name) = LOWER($1) THEN 100
        WHEN LOWER(s.name) LIKE LOWER($1) || '%' THEN 80
        WHEN LOWER(s.name) LIKE '%' || LOWER($1) || '%' OR LOWER(sps.problem_statement) LIKE '%' || LOWER($1) || '%' THEN 50
        ELSE 10
    END as score
FROM scenarios s
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
WHERE 
    LOWER(s.name) LIKE '%' || LOWER($1) || '%'
    OR LOWER(sps.problem_statement) LIKE '%' || LOWER($1) || '%'
ORDER BY score DESC, s.name
LIMIT $2;

