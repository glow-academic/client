WITH user_profile AS (
    SELECT role FROM profiles WHERE id = $1::uuid
)
SELECT 
    a.id::text as agent_id,
    a.name,
    a.description,
    a.reasoning,
    a.temperature,
    a.model_id::text,
    a.updated_at,
    CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_edit,
    CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_delete
FROM agents a
CROSS JOIN user_profile up
ORDER BY a.name

