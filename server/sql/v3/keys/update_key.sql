-- Update a key
-- Parameters: $1=key_id, $2=name, $3=key (encrypted), $4=active
UPDATE keys
SET 
    name = $2,
    key = $3,
    active = $4,
    updated_at = NOW()
WHERE id = $1::uuid
RETURNING 
    id::text as key_id,
    CASE 
        WHEN LENGTH(key) > 4 THEN LEFT(key, 4) || '****'
        ELSE '****'
    END as key_masked

