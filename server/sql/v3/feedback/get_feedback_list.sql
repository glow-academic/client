-- Parameters: none
-- Returns all feedback entries with author information, ordered by resolved status (unresolved first) then created_at DESC
SELECT 
    f.id as feedback_id,
    f.type,
    COALESCE(f.message, '') as message,
    f.created_at,
    f.resolved,
    COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') as author_name,
    COALESCE(
        (SELECT email FROM profile_emails WHERE profile_id = f.profile_id AND is_primary = true AND active = true LIMIT 1),
        ''
    ) as author_email,
    COALESCE(
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true),
        ARRAY[]::text[]
    ) as author_emails,
    COALESCE(f.profile_id::text, '') as author_profile_id
FROM feedback f
LEFT JOIN profiles p ON p.id = f.profile_id
LEFT JOIN profile_emails pe ON pe.profile_id = f.profile_id AND pe.active = true
GROUP BY f.id, f.type, f.message, f.created_at, f.resolved, p.first_name, p.last_name, f.profile_id
ORDER BY f.resolved ASC, f.created_at DESC

