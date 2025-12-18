WITH resolve_profile_id AS (
    SELECT $7::uuid as resolved_profile_id
),
user_profile AS (
    SELECT name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
update_field AS (
    UPDATE fields SET
        name = $2,
        description = $3,
        active = COALESCE($4, active),
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as field_id, $2 as field_name
),
delete_existing_conditional_parameters AS (
    -- Delete all existing conditional parameter links (soft delete)
    UPDATE field_conditional_parameters 
    SET active = false, updated_at = NOW()
    WHERE field_id = $1::uuid
),
link_conditional_parameters AS (
    -- Link field to conditional parameters if provided
    INSERT INTO field_conditional_parameters (field_id, conditional_parameter_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        cond_param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST(COALESCE($6::text[], ARRAY[]::text[])) as cond_param_id
    WHERE $6 IS NOT NULL AND array_length($6::text[], 1) > 0
    ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_existing_departments AS (
    -- Delete all existing department links
    DELETE FROM field_departments 
    WHERE field_id = $1::uuid
),
link_departments AS (
    -- Link field to departments if provided
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST(COALESCE($5::text[], ARRAY[]::text[])) as dept_id
    WHERE $5 IS NOT NULL AND array_length($5::text[], 1) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    uf.field_id,
    uf.field_name,
    up.actor_name
FROM update_field uf
CROSS JOIN user_profile up

