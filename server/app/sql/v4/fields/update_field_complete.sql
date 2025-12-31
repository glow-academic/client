-- Update field with conditional parameters and department links
-- Converted to function

BEGIN;

DROP FUNCTION IF EXISTS api_update_field_v4(uuid, text, text, boolean, text[], text[], uuid);

CREATE OR REPLACE FUNCTION api_update_field_v4(
    field_id uuid,
    name text,
    description text,
    active boolean,
    department_ids text[],
    conditional_parameter_ids text[],
    profile_id uuid
)
RETURNS TABLE (
    field_exists boolean,
    field_id uuid,
    field_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        field_id AS field_id,
        name AS name,
        COALESCE(NULLIF(description, ''), '') AS description,
        COALESCE(active, true) AS active,
        COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(conditional_parameter_ids, ARRAY[]::text[]) AS conditional_parameter_ids,
        profile_id AS profile_id
),
field_exists_check AS (
    -- Check if field exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM fields WHERE id = (SELECT field_id FROM params)
    )::boolean as field_exists
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
object_current_departments AS (
    -- Get field's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM field_departments
    WHERE field_id = (SELECT field_id FROM params) AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = (SELECT profile_id FROM params) AND active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role::text,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
update_field AS (
    UPDATE fields SET
        name = (SELECT name FROM params),
        description = (SELECT description FROM params),
        active = (SELECT active FROM params),
        updated_at = NOW()
    WHERE id = (SELECT field_id FROM params)
    RETURNING id as field_id, (SELECT name FROM params) as field_name
),
delete_existing_conditional_parameters AS (
    -- Delete all existing conditional parameter links (soft delete)
    UPDATE field_conditional_parameters 
    SET active = false, updated_at = NOW()
    WHERE field_id = (SELECT field_id FROM params)
),
link_conditional_parameters AS (
    -- Link field to conditional parameters if provided
    INSERT INTO field_conditional_parameters (field_id, conditional_parameter_id, active, created_at, updated_at)
    SELECT 
        (SELECT field_id FROM params),
        cond_param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.conditional_parameter_ids) as cond_param_id
    WHERE COALESCE(array_length(x.conditional_parameter_ids, 1), 0) > 0
    ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_existing_departments AS (
    -- Delete all existing department links
    DELETE FROM field_departments 
    WHERE field_id = (SELECT field_id FROM params)
),
link_departments AS (
    -- Link field to departments if provided
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        (SELECT field_id FROM params),
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    fec.field_exists::boolean as field_exists,
    uf.field_id,
    uf.field_name,
    up.actor_name
FROM field_exists_check fec
CROSS JOIN user_profile up
LEFT JOIN update_field uf ON fec.field_exists = true
$$;

COMMIT;
