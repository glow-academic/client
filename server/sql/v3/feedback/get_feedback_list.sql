SELECT 
    af.id as feedback_id,
    af.type,
    COALESCE(af.message, '') as message,
    af.created_at,
    COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') as author_name,
    COALESCE(p.alias, '') as author_alias,
    COALESCE(afp.profile_id::text, '') as author_profile_id
FROM app_feedback af
LEFT JOIN app_feedback_profiles afp ON afp.app_feedback_id = af.id AND afp.role = 'author'
LEFT JOIN profiles p ON p.id = afp.profile_id
ORDER BY af.created_at DESC

