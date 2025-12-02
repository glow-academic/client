-- Update model with department, key, and endpoint links in a single transaction
-- Parameters: $1=model_id, $2=provider (enum), $3=name, $4=description, $5=active, 
--            $6=department_ids (text array, nullable), 
--            $7=key_id (text, nullable), $8=base_url (text, nullable), $9=profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $9::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $9::text IS NULL OR $9::text = '' THEN NULL::uuid
            ELSE $9::uuid
        END as resolved_profile_id
),
update_model AS (
    UPDATE models SET
        provider = $2::provider,
        name = $3,
        description = $4,
        active = $5,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as model_id
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
    FROM UNNEST($6::text[]) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (model_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_all_keys AS (
    -- Deactivate all existing default keys
    UPDATE model_keys
    SET active = false, updated_at = NOW()
    WHERE model_id = $1::uuid AND active = true
),
link_key AS (
    -- Link key if provided (default key for model)
    INSERT INTO model_keys (model_id, key_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $7::uuid,
        true,
        NOW(),
        NOW()
    WHERE $7::text IS NOT NULL AND $7::text != ''
    ON CONFLICT (model_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
upsert_endpoint AS (
    -- Upsert endpoint if base_url provided (indicates custom model)
    -- If base_url is empty/null, deactivate existing endpoint
    INSERT INTO model_endpoints (model_id, base_url, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $8::text,
        true,
        NOW(),
        NOW()
    WHERE $8::text IS NOT NULL AND TRIM($8::text) != ''
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
    AND active = true
    AND ($8::text IS NULL OR TRIM($8::text) = '')
)
SELECT model_id FROM update_model

