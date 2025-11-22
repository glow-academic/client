-- List keys filtered by type
-- Parameters: $1=type (e.g., 'auth')
SELECT 
    k.id::text as key_id,
    CASE 
        WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
        ELSE '****'
    END as key_masked,
    k.type::text,
    k.active
FROM keys k
WHERE k.type = $1::key_type
ORDER BY k.created_at DESC

