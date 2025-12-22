-- Create model with department links and endpoint in a single transaction
-- Parameters: $1=provider_id (uuid), $2=name, $3=description, $4=active, 
--            $5=value (text), $6=department_ids (text array, nullable), 
--            $7=base_url (text, nullable), $8=profile_id (uuid, required)
-- Returns: model_id, actor_name
-- profile_id is always a UUID (required in request body)
WITH user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $8::uuid
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role,
        $6::text[]
    ) as validation_passed
    FROM user_profile up
),
actor_profile AS (
    SELECT 
        $8::uuid as resolved_profile_id,
        up.actor_name
    FROM user_profile up
),
new_model AS (
    INSERT INTO models (
        provider_id,
        name,
        description,
        active,
        value
    )
    VALUES ($1::uuid, $2, $3, $4, $5)
    RETURNING id::text as model_id
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO model_departments (model_id, department_id, active, created_at, updated_at)
    SELECT 
        nm.model_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_model nm
    CROSS JOIN UNNEST($6::text[]) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (model_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
create_endpoint AS (
    -- Create model endpoint if base_url is provided
    INSERT INTO model_endpoints (model_id, base_url, active, created_at, updated_at)
    SELECT 
        nm.model_id::uuid,
        $7::text,
        true,
        NOW(),
        NOW()
    FROM new_model nm
    WHERE $7 IS NOT NULL AND TRIM($7) != ''
    ON CONFLICT (model_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
)
SELECT 
    nm.model_id as id,
    ap.actor_name
FROM new_model nm
CROSS JOIN actor_profile ap

