-- Update a key with department links
-- Parameters: $1=key_id, $2=name, $3=key (encrypted), $4=description, $5=active, $6=department_ids (text array, nullable)
WITH update_key AS (
    UPDATE keys
    SET 
        name = $2,
        key = $3,
        description = $4,
        active = $5,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as key_id, key
),
replace_departments AS (
    -- Deactivate all existing department links
    UPDATE key_departments 
    SET active = false, updated_at = NOW()
    WHERE key_id = $1::uuid AND active = true
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO key_departments (key_id, department_id, active, created_at, updated_at)
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
    key_id,
    CASE 
        WHEN LENGTH(key) > 4 THEN LEFT(key, 4) || '****'
        ELSE '****'
    END as key_masked
FROM update_key
