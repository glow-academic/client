-- Delete field
-- Converted to function

BEGIN;

DROP FUNCTION IF EXISTS api_delete_field_v3(uuid, uuid);

CREATE OR REPLACE FUNCTION api_delete_field_v3(
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
        SELECT 1 FROM fields WHERE id = (SELECT field_id FROM params)
    )::boolean as field_exists
),
user_profile AS (
    SELECT p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
field_to_delete AS (
    SELECT 
        f.id,
        f.name
    FROM params x
    JOIN fields f ON f.id = x.field_id
),
deleted_field AS (
    -- Delete field (cascade deletes parameter_fields and field_departments)
    DELETE FROM fields
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

COMMIT;
