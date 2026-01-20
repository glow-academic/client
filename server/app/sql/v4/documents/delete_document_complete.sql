-- Delete document with actor tracking
-- Converted to function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_document_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_document_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_document_v4(
    document_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    success boolean,
    message text,
    document_id uuid,
    document_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT document_id AS document_id,
           profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
document_info AS (
    SELECT 
        d.id, 
        (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1) as name
    FROM document_artifact d
    WHERE d.id = (SELECT document_id FROM params)
),
delete_result AS (
    DELETE FROM document_artifact WHERE id = (SELECT document_id FROM params)
    RETURNING id
)
SELECT 
    true::boolean as success,
    'Document deleted successfully'::text as message,
    di.id as document_id,
    di.name as document_name,
    ap.actor_name
FROM document_info di
CROSS JOIN actor_profile ap
WHERE EXISTS (SELECT 1 FROM delete_result)
LIMIT 1
$$;