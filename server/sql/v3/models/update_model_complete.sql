-- Update model with department links and endpoint in a single transaction
-- Parameters: $1=model_id, $2=provider_id (uuid), $3=name, $4=description, $5=active, 
--            $6=value (text), $7=department_ids (text array, nullable), 
--            $8=base_url (text, nullable), $9=profile_id (uuid)
WITH update_model AS (
    UPDATE models SET
        provider_id = $2::uuid,
        name = $3,
        description = $4,
        active = $5,
        value = $6,
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
SELECT model_id FROM update_model

