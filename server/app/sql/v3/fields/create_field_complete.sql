-- Create field with conditional parameters and department links
-- Converted to function

BEGIN;

DROP FUNCTION IF EXISTS api_create_field_v3(text, text, boolean, text[], text[], uuid);

CREATE OR REPLACE FUNCTION api_create_field_v3(
    name text,
    description text,
    active boolean,
    department_ids text[],
    conditional_parameter_ids text[],
    profile_id uuid
)
RETURNS TABLE (
    field_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        name AS name,
        COALESCE(NULLIF(description, ''), '') AS description,
        COALESCE(active, true) AS active,
        COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(conditional_parameter_ids, ARRAY[]::text[]) AS conditional_parameter_ids,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role::text,
        x.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN params x
),
actor_profile AS (
    SELECT 
        x.profile_id AS resolved_profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
new_field AS (
    INSERT INTO fields (
        name,
        description,
        active
    )
    SELECT x.name, x.description, x.active
    FROM params x
    RETURNING id as field_id
),
link_conditional_parameters AS (
    -- Link field to conditional parameters if provided
    INSERT INTO field_conditional_parameters (field_id, conditional_parameter_id, active, created_at, updated_at)
    SELECT 
        nf.field_id,
        cond_param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.conditional_parameter_ids) as cond_param_id
    WHERE COALESCE(array_length(x.conditional_parameter_ids, 1), 0) > 0
    ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link field to departments if provided
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        nf.field_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    nf.field_id,
    ap.actor_name
FROM new_field nf
CROSS JOIN actor_profile ap
$$;

COMMIT;
