-- Delete a key (cascade deletes department_keys)
-- Parameters: $1=keyId (uuid), $2=profileId (uuid)
-- Returns: key_id, name, actor_name if deletion successful
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
key_info AS (
    SELECT id, name FROM keys WHERE id = $1::uuid
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
    WHERE id = (SELECT id FROM key_info)
    AND EXISTS (SELECT 1 FROM check_permissions WHERE can_delete = true)
    RETURNING id
)
SELECT 
    (SELECT id::text FROM key_info) as key_id,
    (SELECT name FROM key_info) as name,
    (SELECT actor_name FROM actor_profile) as actor_name
WHERE EXISTS (SELECT 1 FROM delete_key)

