-- Search profiles by first_name, last_name, or email
-- Uses ILIKE for case-insensitive fuzzy matching
-- Params: $1 = query pattern (with % wildcards)
SELECT 
    p.id,
    p.first_name,
    p.last_name,
    ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
    (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
    p.role,
    CASE 
        WHEN LOWER(p.first_name) = LOWER($1) OR LOWER(p.last_name) = LOWER($1) OR EXISTS (SELECT 1 FROM profile_emails WHERE profile_id = p.id AND active = true AND LOWER(email) = LOWER($1)) THEN 100
        WHEN LOWER(p.first_name) LIKE LOWER($1) || '%' OR LOWER(p.last_name) LIKE LOWER($1) || '%' OR EXISTS (SELECT 1 FROM profile_emails WHERE profile_id = p.id AND active = true AND LOWER(email) LIKE LOWER($1) || '%') THEN 80
        WHEN LOWER(p.first_name) LIKE '%' || LOWER($1) || '%' OR LOWER(p.last_name) LIKE '%' || LOWER($1) || '%' OR EXISTS (SELECT 1 FROM profile_emails WHERE profile_id = p.id AND active = true AND LOWER(email) LIKE '%' || LOWER($1) || '%') THEN 50
        ELSE 10
    END as score
FROM profiles p
LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
WHERE 
    LOWER(p.first_name) LIKE '%' || LOWER($1) || '%'
    OR LOWER(p.last_name) LIKE '%' || LOWER($1) || '%'
    OR EXISTS (SELECT 1 FROM profile_emails WHERE profile_id = p.id AND active = true AND LOWER(email) LIKE '%' || LOWER($1) || '%')
GROUP BY p.id, p.first_name, p.last_name, p.role
ORDER BY score DESC, p.first_name, p.last_name
LIMIT $2;

