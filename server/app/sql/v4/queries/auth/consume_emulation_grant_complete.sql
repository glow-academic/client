-- Consume emulation grant for default-idp flow
-- Uses safe drop/recreate pattern: drop function first, then recreate
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_consume_emulation_grant_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_consume_emulation_grant_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_consume_emulation_grant_v4(
    grant_id uuid
)
RETURNS TABLE (
    ok boolean,
    reason text,
    actor_profile_id uuid,
    target_profile_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT grant_id AS grant_id
),
grant_row AS (
    SELECT *
    FROM grants_entry eg
    WHERE eg.id = (SELECT grant_id FROM params)
),
validity AS (
    SELECT
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM grant_row) THEN false
            WHEN (SELECT revoked_at FROM grant_row) IS NOT NULL THEN false
            WHEN (SELECT used_at FROM grant_row) IS NOT NULL THEN false
            WHEN (SELECT expires_at FROM grant_row) <= NOW() THEN false
            ELSE true
        END as ok
),
reason_computed AS (
    SELECT
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM grant_row) THEN 'Grant not found'::text
            WHEN (SELECT revoked_at FROM grant_row) IS NOT NULL THEN 'Grant revoked'::text
            WHEN (SELECT used_at FROM grant_row) IS NOT NULL THEN 'Grant already used'::text
            WHEN (SELECT expires_at FROM grant_row) <= NOW() THEN 'Grant expired'::text
            ELSE NULL::text
        END as reason
),
grant_consumed AS (
    UPDATE grants_entry
    SET used_at = NOW(),
        updated_at = NOW()
    WHERE id = (SELECT grant_id FROM params)
      AND (SELECT ok FROM validity) = true
    RETURNING id
)
SELECT
    (SELECT ok FROM validity) as ok,
    (SELECT reason FROM reason_computed) as reason,
    (SELECT pgj.profile_id FROM profile_grants_junction pgj WHERE pgj.grant_id = (SELECT id FROM grant_consumed) LIMIT 1) as actor_profile_id,
    (SELECT pej.profile_id FROM emulations_entry em JOIN profile_emulations_junction pej ON pej.emulation_id = em.id WHERE em.grant_id = (SELECT id FROM grant_consumed) LIMIT 1) as target_profile_id
$$;
