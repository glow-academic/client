-- Delete a key (cascade deletes key_departments)
-- Parameters: $1=keyId (uuid), $2=profileId (uuid or "guest-profile-id")
-- Returns: key_id if deletion successful
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
key_departments_data AS (
    SELECT 
        ARRAY_AGG(kd.department_id::text ORDER BY kd.created_at) as department_ids
    FROM key_departments kd
    WHERE kd.key_id = $1::uuid AND kd.active = true
),
user_departments AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
check_permissions AS (
    SELECT 
        CASE 
            -- Default keys (no department_ids) can only be deleted by superadmin
            WHEN COALESCE(kdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role = 'admin' AND (
                COUNT(kd.key_id) FILTER (WHERE kd.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM key_departments kd2 WHERE kd2.key_id = $1::uuid AND kd2.active = true)
            ) THEN true
            ELSE false
        END as can_delete
    FROM user_profile up
    LEFT JOIN key_departments kd ON kd.key_id = $1::uuid AND kd.active = true
    LEFT JOIN key_departments_data kdd ON true
    GROUP BY up.role, kdd.department_ids
),
delete_key AS (
    DELETE FROM keys
    WHERE id = $1::uuid
    AND EXISTS (SELECT 1 FROM check_permissions WHERE can_delete = true)
    RETURNING id::text as key_id
)
SELECT key_id FROM delete_key

