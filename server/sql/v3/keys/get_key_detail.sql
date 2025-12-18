-- Get key detail with optional full key display
-- Parameters: $1=key_id, $2=show_full (boolean), $3=profile_id (uuid)
WITH actor_profile AS (
    SELECT 
        $3::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $3::uuid
)
SELECT 
    k.id::text as key_id,
    k.name,
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
    k.description,
    k.active,
    ap.actor_name
FROM keys k
CROSS JOIN actor_profile ap
WHERE k.id = $1::uuid

