-- Create a new key
-- Parameters: $1=key, $2=type, $3=active
WITH new_key AS (
    INSERT INTO keys (
        key,
        type,
        active
    )
    VALUES ($1, $2::key_type, $3)
    RETURNING id::text as key_id, key
)
SELECT 
    key_id,
    CASE 
        WHEN LENGTH(key) > 4 THEN LEFT(key, 4) || '****'
        ELSE '****'
    END as key_masked
FROM new_key

