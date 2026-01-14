-- Get key for decryption (returns full key, not masked)
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_key_for_decrypt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_key_for_decrypt_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function (no types to drop for decrypt)
CREATE OR REPLACE FUNCTION api_get_key_for_decrypt_v4(
    key_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    key text,
    name text,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT key_id AS key_id, profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
)
SELECT 
    k.key::text as key,
    (SELECT n.name FROM key_names kn JOIN names_resource n ON kn.name_id = n.id WHERE kn.key_id = k.id LIMIT 1)::text as name,
    ap.actor_name::text as actor_name
FROM params x
JOIN keys k ON k.id = x.key_id
CROSS JOIN actor_profile ap
$$;