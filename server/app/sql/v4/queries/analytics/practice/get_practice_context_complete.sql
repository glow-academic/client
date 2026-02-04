-- Practice context for training list endpoint.
-- Returns actor identity + default pass threshold.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_practice_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_practice_context_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_practice_context_v4(
    profile_id uuid
)
RETURNS TABLE (
    actor_name text,
    pass_threshold numeric
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(pr.name, '')::text AS actor_name,
    70.0::numeric AS pass_threshold
FROM profiles_resource pr
WHERE pr.id = api_get_practice_context_v4.profile_id
LIMIT 1;
$$;
