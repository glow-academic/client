WITH resolve_profile_id AS (
    SELECT $2::uuid as resolved_profile_id
),
user_profile AS (
    SELECT name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
field_to_delete AS (
    SELECT 
        f.id,
        f.name
    FROM fields f
    WHERE f.id = $1::uuid
)
-- Delete field (cascade deletes parameter_fields and field_departments)
DELETE FROM fields
WHERE id = (SELECT id FROM field_to_delete)
RETURNING 
    (SELECT name FROM field_to_delete) as name,
    (SELECT actor_name FROM user_profile) as actor_name

