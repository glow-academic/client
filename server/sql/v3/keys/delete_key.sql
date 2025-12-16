-- Delete a key (cascade deletes department_keys)
-- Parameters: $1=keyId (uuid), $2=profileId (uuid)
-- Returns: key_id if deletion successful
WITH user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
department_keys_data AS (
    SELECT 
        ARRAY_AGG(kd.department_id::text ORDER BY kd.created_at) as department_ids
    FROM department_keys kd
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
                OR NOT EXISTS (SELECT 1 FROM department_keys kd2 WHERE kd2.key_id = $1::uuid AND kd2.active = true)
            ) THEN true
            ELSE false
        END as can_delete
    FROM user_profile up
    LEFT JOIN department_keys kd ON kd.key_id = $1::uuid AND kd.active = true
    LEFT JOIN department_keys_data kdd ON true
    GROUP BY up.role, kdd.department_ids
),
delete_key AS (
    DELETE FROM keys
    WHERE id = $1::uuid
    AND EXISTS (SELECT 1 FROM check_permissions WHERE can_delete = true)
    RETURNING id::text as key_id
)
SELECT key_id FROM delete_key

