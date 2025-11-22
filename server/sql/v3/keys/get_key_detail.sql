-- Get key detail with optional full key display
-- Parameters: $1=key_id, $2=show_full (boolean)
SELECT 
    k.id::text as key_id,
    CASE 
        WHEN $2 = true THEN k.key
        ELSE CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END
    END as key,
    CASE 
        WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
        ELSE '****'
    END as key_masked,
    k.type::text,
    k.active
FROM keys k
WHERE k.id = $1::uuid

