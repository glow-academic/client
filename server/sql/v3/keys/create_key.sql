-- Create a new key with department links
-- Parameters: $1=name, $2=key (encrypted), $3=type, $4=active, $5=department_ids (text array, nullable)
WITH new_key AS (
    INSERT INTO keys (
        name,
        key,
        type,
        active
    )
    VALUES ($1, $2, $3::key_type, $4)
    RETURNING id::text as key_id, key
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO key_departments (key_id, department_id, active, created_at, updated_at)
    SELECT 
        nk.key_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_key nk
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
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
FROM new_key
