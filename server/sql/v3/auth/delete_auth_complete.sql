-- Delete auth entry (cascade will handle auth_items)
-- Parameters: $1=auth_id, $2=profile_id (uuid)
WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
auth_info AS (
    SELECT id, name
    FROM auth
    WHERE id = $1::uuid
),
delete_result AS (
    DELETE FROM auth
    WHERE id = (SELECT id FROM auth_info)
    RETURNING id
)
SELECT 
    (SELECT id::text FROM auth_info) as auth_id,
    (SELECT name FROM auth_info) as name,
    (SELECT actor_name FROM actor_profile) as actor_name

