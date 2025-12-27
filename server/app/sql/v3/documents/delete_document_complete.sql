-- Delete document with actor tracking
-- Converted to function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_document_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_document_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_document_v3(
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
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
document_info AS (
    SELECT id, name FROM documents WHERE id = (SELECT document_id FROM params)
),
delete_result AS (
    DELETE FROM documents WHERE id = (SELECT document_id FROM params)
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

COMMIT;

