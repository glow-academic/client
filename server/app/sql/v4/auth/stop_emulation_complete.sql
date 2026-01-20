-- Stop emulation - revoke emulation grants for current profile
-- Uses safe drop/recreate pattern: drop function first, then recreate
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_stop_emulation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_stop_emulation_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_stop_emulation_v4(
    profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    revoked_count bigint
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
revoked AS (
    UPDATE emulation_grants
    SET revoked_at = NOW(),
        updated_at = NOW()
    WHERE (actor_profile_id = (SELECT profile_id FROM params)
        OR target_profile_id = (SELECT profile_id FROM params))
      AND revoked_at IS NULL
    RETURNING 1
)
SELECT COALESCE(COUNT(*), 0)::bigint as revoked_count
FROM revoked
$$;
