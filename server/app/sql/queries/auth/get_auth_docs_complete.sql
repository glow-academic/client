-- Auth Docs - Page metadata name lookup
-- Returns the name resource ID for an entity (used by /docs endpoint)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_auth_docs_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_docs_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_auth_docs_v4(
    p_entity_id uuid DEFAULT NULL
)
RETURNS TABLE (
    names_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT j.names_id
FROM auth_names_junction j
WHERE p_entity_id IS NOT NULL
  AND j.auth_id = p_entity_id
  AND j.active = true
LIMIT 1;
$$;
