WITH resolve_profile_id AS (
    SELECT $2::uuid as resolved_profile_id
),
user_profile AS (
    SELECT p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
field_to_delete AS (
    SELECT 
        f.id,
        f.name
    FROM fields f
    WHERE f.id = $1::uuid
),
deleted_field AS (
    -- Delete field (cascade deletes parameter_fields and field_departments)
    DELETE FROM fields
    WHERE id = (SELECT id FROM field_to_delete)
    RETURNING id, (SELECT name FROM field_to_delete) as name
)
SELECT 
    df.name,
    up.actor_name
FROM deleted_field df
CROSS JOIN user_profile up

