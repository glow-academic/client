-- Create field with conditional parameters and department links
-- Converted to function
DROP FUNCTION IF EXISTS api_create_field_v4(text, text, boolean, text[], text[], uuid);

CREATE OR REPLACE FUNCTION api_create_field_v4(
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
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
-- Insert name into names table and get ID
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description into descriptions table and get ID
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_field AS (
    -- Create field (without name/description/active columns)
    INSERT INTO field (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params x
    RETURNING id as field_id
),
-- Link field to name
link_field_name AS (
    INSERT INTO field_names (field_id, name_id, created_at, updated_at)
    SELECT 
        nf.field_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN name_resource nr
    ON CONFLICT (field_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link field to description
link_field_description AS (
    INSERT INTO field_descriptions (field_id, description_id, created_at, updated_at)
    SELECT 
        nf.field_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN description_resource dr
    ON CONFLICT (field_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link field active flag
link_field_active_flag AS (
    INSERT INTO field_flags (field_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        nf.field_id,
        f.id,
        'active'::type_field_flags,
        x.active,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (field_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
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