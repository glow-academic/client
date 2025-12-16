SELECT 
    f.id as feedback_id,
    f.type,
    COALESCE(f.message, '') as message,
    f.created_at,
    COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') as author_name,
    COALESCE((SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1), '') as author_email,
    ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as author_emails,
    COALESCE(f.profile_id::text, '') as author_profile_id
FROM feedback f
LEFT JOIN profiles p ON p.id = f.profile_id
LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
GROUP BY f.id, f.type, f.message, f.created_at, p.first_name, p.last_name, f.profile_id
ORDER BY f.created_at DESC

