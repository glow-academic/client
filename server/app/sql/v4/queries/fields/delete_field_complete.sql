-- Delete field
-- Converted to function
DROP FUNCTION IF EXISTS api_delete_field_v4(uuid, uuid);

CREATE OR REPLACE FUNCTION api_delete_field_v4(
    field_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    field_exists boolean,
    name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        field_id AS field_id,
        profile_id AS profile_id
),
field_exists_check AS (
    -- Check if field exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM field_artifact WHERE id = (SELECT field_id FROM params)
    )::boolean as field_exists
),
user_profile AS (
    SELECT actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
field_to_delete AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1)
    FROM params x
    JOIN fields_resource f ON f.id = x.field_id
),
deleted_field AS (
    -- Delete field (cascade deletes field_departments_junction; parameter_id is just a foreign key reference)
    DELETE FROM field_artifact
    WHERE id = (SELECT id FROM field_to_delete)
    RETURNING id, (SELECT name FROM field_to_delete) as name
)
SELECT 
    fec.field_exists::boolean as field_exists,
    df.name,
    up.actor_name
FROM field_exists_check fec
CROSS JOIN user_profile up
LEFT JOIN deleted_field df ON fec.field_exists = true
$$;