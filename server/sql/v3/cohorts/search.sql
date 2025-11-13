-- Search cohorts by title or description
-- Params: $1 = query pattern (with % wildcards), $2 = limit
SELECT 
    c.id,
    c.title,
    c.active,
    c.description,
    COALESCE(
        (SELECT COUNT(*)
         FROM cohort_profiles cp
         WHERE cp.cohort_id = c.id AND cp.active = true),
        0
    ) as profile_count,
    CASE 
        WHEN LOWER(c.title) = LOWER($1) THEN 100
        WHEN LOWER(c.title) LIKE LOWER($1) || '%' THEN 80
        WHEN LOWER(c.title) LIKE '%' || LOWER($1) || '%' OR LOWER(c.description) LIKE '%' || LOWER($1) || '%' THEN 50
        ELSE 10
    END as score
FROM cohorts c
WHERE 
    LOWER(c.title) LIKE '%' || LOWER($1) || '%'
    OR LOWER(c.description) LIKE '%' || LOWER($1) || '%'
ORDER BY score DESC, c.title
LIMIT $2;

