-- Create field with conditional parameters and department links
-- Parameters: $1=name, $2=description, $3=active, $4=department_ids (nullable text array), $5=conditional_parameter_ids (nullable text array), $6=profile_id (uuid, required)
-- Returns: field_id, actor_name
-- profile_id is always a UUID (required in request body)
WITH user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $6::uuid
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role::text,
        $4::text[]
    ) as validation_passed
    FROM user_profile up
),
actor_profile AS (
    SELECT 
        $6::uuid as resolved_profile_id,
        up.actor_name
    FROM user_profile up
),
new_field AS (
    INSERT INTO fields (
        name,
        description,
        active
    )
    VALUES ($1, $2, COALESCE($3, true))
    RETURNING id::text as field_id
),
link_conditional_parameters AS (
    -- Link field to conditional parameters if provided
    INSERT INTO field_conditional_parameters (field_id, conditional_parameter_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        cond_param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN UNNEST(COALESCE($5::text[], ARRAY[]::text[])) as cond_param_id
    WHERE $5 IS NOT NULL AND array_length($5::text[], 1) > 0
    ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link field to departments if provided
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN UNNEST(COALESCE($4::text[], ARRAY[]::text[])) as dept_id
    WHERE $4 IS NOT NULL AND array_length($4::text[], 1) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    nf.field_id,
    ap.actor_name
FROM new_field nf
CROSS JOIN actor_profile ap

