-- Search personas by name
-- Params: $1 = query pattern (with % wildcards), $2 = limit
SELECT 
    p.id,
    p.name,
    p.description,
    CASE 
        WHEN LOWER(p.name) = LOWER($1) THEN 100
        WHEN LOWER(p.name) LIKE LOWER($1) || '%' THEN 80
        WHEN LOWER(p.name) LIKE '%' || LOWER($1) || '%' THEN 50
        ELSE 10
    END as score
FROM personas p
WHERE LOWER(p.name) LIKE '%' || LOWER($1) || '%'
ORDER BY score DESC, p.name
LIMIT $2;

