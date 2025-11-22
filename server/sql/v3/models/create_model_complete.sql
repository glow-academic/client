-- Create model with department and key links in a single transaction
-- Parameters: $1=provider_id, $2=name, $3=description, $4=active, $5=custom_model, $6=image_model, 
--            $7=input_ppm, $8=output_ppm, $9=department_ids (text array, nullable), $10=key_id (text, nullable)
WITH new_model AS (
    INSERT INTO models (
        provider_id,
        name,
        description,
        active,
        custom_model,
        image_model,
        input_ppm,
        output_ppm
    )
    VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
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
)
SELECT model_id FROM new_model

