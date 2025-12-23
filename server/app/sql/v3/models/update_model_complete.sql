-- Update model with department links and endpoint in a single transaction
-- Parameters: $1=model_id, $2=provider_id (uuid), $3=name, $4=description, $5=active, 
--            $6=value (text), $7=department_ids (text array, nullable), 
--            $8=base_url (text, nullable), $9=profile_id (uuid)
-- Returns: model_id, model_name, actor_name
WITH user_profile AS (
    SELECT
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $9::uuid
),
object_current_departments AS (
    -- Get model's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM model_departments
    WHERE model_id = $1::uuid AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = $9::uuid AND active = true
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
actor_profile AS (
    SELECT
        $9::uuid as profile_id,
        up.actor_name
    FROM user_profile up
),
update_model AS (
    UPDATE models SET
        provider_id = $2::uuid,
        name = $3,
        description = $4,
        active = $5,
        value = $6,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as model_id, name as model_name
),
deactivate_all_departments AS (
    -- Deactivate all existing department links
    UPDATE model_departments
    SET active = false, updated_at = NOW()
    WHERE model_id = $1::uuid AND active = true
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO model_departments (model_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($7::text[]) as dept_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
    ON CONFLICT (model_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
update_endpoint AS (
    -- Update or create model endpoint if base_url is provided
    INSERT INTO model_endpoints (model_id, base_url, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $8::text,
        true,
        NOW(),
        NOW()
    WHERE $8 IS NOT NULL AND TRIM($8) != ''
    ON CONFLICT (model_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
),
deactivate_endpoint AS (
    -- Deactivate endpoint if base_url is null or empty
    UPDATE model_endpoints
    SET active = false, updated_at = NOW()
    WHERE model_id = $1::uuid
      AND ($8 IS NULL OR TRIM($8) = '')
)
SELECT um.model_id, um.model_name, ap.actor_name
FROM update_model um
CROSS JOIN actor_profile ap

