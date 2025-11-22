-- Update model with department and key links in a single transaction
-- Parameters: $1=model_id, $2=provider_id, $3=name, $4=description, $5=active, $6=custom_model, 
--            $7=image_model, $8=input_ppm, $9=output_ppm, $10=department_ids (text array, nullable), $11=key_id (text, nullable)
WITH update_model AS (
    UPDATE models SET
        provider_id = $2::uuid,
        name = $3,
        description = $4,
        active = $5,
        custom_model = $6,
        image_model = $7,
        input_ppm = $8,
        output_ppm = $9,
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
    FROM UNNEST($10::text[]) as dept_id
    WHERE COALESCE(array_length($10::text[], 1), 0) > 0
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
        $11::uuid,
        true,
        NOW(),
        NOW()
    WHERE $11::text IS NOT NULL AND $11::text != ''
    ON CONFLICT (model_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT model_id FROM update_model

