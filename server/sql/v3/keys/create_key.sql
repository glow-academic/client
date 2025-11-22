-- Create a new key
-- Parameters: $1=name, $2=key, $3=type, $4=active
WITH new_key AS (
    INSERT INTO keys (
        name,
        key,
        type,
        active
    )
    VALUES ($1, $2, $3::key_type, $4)
    RETURNING id::text as key_id, key
)
SELECT 
    key_id,
    CASE 
        WHEN LENGTH(key) > 4 THEN LEFT(key, 4) || '****'
        ELSE '****'
    END as key_masked
FROM new_key

