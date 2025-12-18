-- Parameters: search=text (optional)
-- Returns total count of activity entries matching search criteria
SELECT COUNT(*) as total_count
FROM activity a
LEFT JOIN profiles p ON p.id = a.profile_id
WHERE ($1::text IS NULL OR $1::text = '' OR a.message ILIKE '%' || $1::text || '%' OR COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') ILIKE '%' || $1::text || '%');

