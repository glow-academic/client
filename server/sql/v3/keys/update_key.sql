-- Update a key with department links
-- Parameters: $1=key_id, $2=name, $3=key (encrypted), $4=description, $5=active, $6=department_ids (text array, nullable), $7=profile_id (uuid)
-- Returns: key_id, key_masked, key_name, actor_name
WITH user_profile AS (
    SELECT
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $7::uuid
),
object_current_departments AS (
    -- Get key's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM department_keys
    WHERE key_id = $1::uuid AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = $7::uuid AND active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
actor_profile AS (
    SELECT
        $7::uuid as profile_id,
        up.actor_name
    FROM user_profile up
),
update_key AS (
    UPDATE keys
    SET 
        name = $2,
        key = $3,
        description = $4,
        active = $5,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as key_id, key, name as key_name
),
replace_departments AS (
    -- Deactivate all existing department links
    UPDATE department_keys 
    SET active = false, updated_at = NOW()
    WHERE key_id = $1::uuid AND active = true
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO department_keys (key_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($6::text[]) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (key_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    uk.key_id,
    CASE 
        WHEN LENGTH(uk.key) > 4 THEN LEFT(uk.key, 4) || '****'
        ELSE '****'
    END as key_masked,
    uk.key_name,
    ap.actor_name
FROM update_key uk
CROSS JOIN actor_profile ap
