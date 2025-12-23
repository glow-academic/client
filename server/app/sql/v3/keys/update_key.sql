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
    -- NOTE: department_keys table was removed in migration 74
    -- Keys are now linked to departments through settings
    -- Use $6 to help PostgreSQL infer type (even though it's not used)
    SELECT COALESCE($6::text[], ARRAY[]::text[]) as department_ids
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
    -- NOTE: department_keys table was removed in migration 74
    SELECT 1 WHERE false
),
link_departments AS (
    -- NOTE: department_keys table was removed in migration 74
    -- Keys are now linked to departments through settings
    SELECT 1 WHERE false
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
