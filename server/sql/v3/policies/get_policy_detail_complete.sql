-- Get policy detail
-- Parameters: $1 = policy_id (uuid), $2 = profile_id (uuid)

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
policy_core AS (
    SELECT 
        p.id,
        p.name,
        p.description,
        p.file_path,
        p.mime_type,
        p.active,
        p.created_at,
        p.updated_at,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_delete
    FROM policies p
    CROSS JOIN user_profile up
    WHERE p.id = $1::uuid
)
SELECT 
    pc.name,
    pc.description,
    pc.file_path,
    pc.mime_type,
    pc.active,
    pc.created_at::text,
    pc.updated_at::text,
    pc.can_edit,
    pc.can_delete,
    '{}'::jsonb as department_mapping
FROM policy_core pc

