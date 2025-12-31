-- Delete document with actor tracking
-- Parameters: $1=document_id (uuid), $2=profile_id (uuid)
-- Returns: document_id, document_name, actor_name
WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
document_info AS (
    SELECT id, name FROM documents WHERE id = $1
),
delete_result AS (
    DELETE FROM documents WHERE id = $1
    RETURNING id
)
SELECT 
    di.id::text as document_id,
    di.name as document_name,
    ap.actor_name
FROM document_info di
CROSS JOIN actor_profile ap
WHERE EXISTS (SELECT 1 FROM delete_result)

