-- Search simulations by title
-- Params: $1 = query pattern (with % wildcards), $2 = limit
SELECT 
    s.id,
    s.title,
    s.active,
    COALESCE(
        (SELECT SUM(stl.time_limit_seconds)
         FROM scenario_time_limits stl
         JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
         WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
        0
    ) as time_limit,
    s.created_at,
    CASE 
        WHEN LOWER(s.title) = LOWER($1) THEN 100
        WHEN LOWER(s.title) LIKE LOWER($1) || '%' THEN 80
        WHEN LOWER(s.title) LIKE '%' || LOWER($1) || '%' THEN 50
        ELSE 10
    END as score
FROM simulations s
WHERE LOWER(s.title) LIKE '%' || LOWER($1) || '%'
ORDER BY score DESC, s.title
LIMIT $2;

