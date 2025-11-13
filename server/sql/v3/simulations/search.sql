-- Search simulations by title
-- Params: $1 = query pattern (with % wildcards), $2 = limit
SELECT 
    s.id,
    s.title,
    s.active,
    stl.time_limit_seconds as time_limit,
    s.created_at,
    CASE 
        WHEN LOWER(s.title) = LOWER($1) THEN 100
        WHEN LOWER(s.title) LIKE LOWER($1) || '%' THEN 80
        WHEN LOWER(s.title) LIKE '%' || LOWER($1) || '%' THEN 50
        ELSE 10
    END as score
FROM simulations s
LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
WHERE LOWER(s.title) LIKE '%' || LOWER($1) || '%'
ORDER BY score DESC, s.title
LIMIT $2;

