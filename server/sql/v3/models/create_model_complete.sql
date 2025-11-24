-- Create model with department, key, and endpoint links in a single transaction
-- Parameters: $1=provider (enum), $2=model_type (enum), $3=name, $4=description, $5=active, $6=image_model, 
--            $7=input_ppm, $8=output_ppm, $9=department_ids (text array, nullable), 
--            $10=key_id (text, nullable), $11=base_url (text, nullable), $12=profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $12::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $12::text IS NULL OR $12::text = '' THEN NULL::uuid
            ELSE $12::uuid
        END as resolved_profile_id
),
new_model AS (
    INSERT INTO models (
        provider,
        model_type,
        name,
        description,
        active,
        image_model,
        input_ppm,
        output_ppm
    )
    VALUES ($1::provider, $2::model_type, $3, $4, $5, $6, $7, $8)
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
    CROSS JOIN UNNEST($9::text[]) as dept_id
    WHERE COALESCE(array_length($9::text[], 1), 0) > 0
    ON CONFLICT (model_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_key AS (
    -- Link key if provided (default key for model)
    INSERT INTO model_keys (model_id, key_id, active, created_at, updated_at)
    SELECT 
        nm.model_id::uuid,
        $10::uuid,
        true,
        NOW(),
        NOW()
    FROM new_model nm
    WHERE $10::text IS NOT NULL AND $10::text != ''
    ON CONFLICT (model_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_endpoint AS (
    -- Link endpoint if base_url provided (indicates custom model)
    INSERT INTO model_endpoints (model_id, base_url, active, created_at, updated_at)
    SELECT 
        nm.model_id::uuid,
        $11::text,
        true,
        NOW(),
        NOW()
    FROM new_model nm
    WHERE $11::text IS NOT NULL AND TRIM($11::text) != ''
    ON CONFLICT (model_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
)
SELECT model_id FROM new_model

