-- Parameters: page=integer, page_size=integer, search=text (optional)
-- Returns paginated activity entries with profile name (not endpoint), ordered by created_at DESC
SELECT 
    a.id as activity_id,
    a.created_at,
    a.message,
    a.error,
    COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') as profile_name,
    COALESCE(p.id::text, '') as profile_id
FROM activity a
LEFT JOIN profiles p ON p.id = a.profile_id
WHERE ($3::text IS NULL OR $3::text = '' OR a.message ILIKE '%' || $3::text || '%' OR COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') ILIKE '%' || $3::text || '%')
ORDER BY a.created_at DESC
LIMIT $2::integer OFFSET (($1::integer * $2::integer));

