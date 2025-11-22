SELECT 
    af.id as feedback_id,
    af.type,
    COALESCE(af.message, '') as message,
    af.created_at,
    COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') as author_name,
    COALESCE((SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1), '') as author_email,
    ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as author_emails,
    COALESCE(afp.profile_id::text, '') as author_profile_id
FROM app_feedback af
LEFT JOIN app_feedback_profiles afp ON afp.app_feedback_id = af.id AND afp.role = 'author'
LEFT JOIN profiles p ON p.id = afp.profile_id
LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
GROUP BY af.id, af.type, af.message, af.created_at, p.first_name, p.last_name, afp.profile_id
ORDER BY af.created_at DESC

