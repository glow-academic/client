-- Search profiles by first_name, last_name, or alias
-- Uses ILIKE for case-insensitive fuzzy matching
-- Params: $1 = query pattern (with % wildcards)
SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.alias,
    p.role,
    CASE 
        WHEN LOWER(p.first_name) = LOWER($1) OR LOWER(p.last_name) = LOWER($1) OR LOWER(p.alias) = LOWER($1) THEN 100
        WHEN LOWER(p.first_name) LIKE LOWER($1) || '%' OR LOWER(p.last_name) LIKE LOWER($1) || '%' OR LOWER(p.alias) LIKE LOWER($1) || '%' THEN 80
        WHEN LOWER(p.first_name) LIKE '%' || LOWER($1) || '%' OR LOWER(p.last_name) LIKE '%' || LOWER($1) || '%' OR LOWER(p.alias) LIKE '%' || LOWER($1) || '%' THEN 50
        ELSE 10
    END as score
FROM profiles p
WHERE 
    LOWER(p.first_name) LIKE '%' || LOWER($1) || '%'
    OR LOWER(p.last_name) LIKE '%' || LOWER($1) || '%'
    OR LOWER(p.alias) LIKE '%' || LOWER($1) || '%'
ORDER BY score DESC, p.first_name, p.last_name
LIMIT $2;

