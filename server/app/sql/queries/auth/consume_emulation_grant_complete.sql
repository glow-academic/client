-- Consume emulation grant for default-idp flow
-- Append-only: inserts into grant_consumptions_entry instead of mutating grants_entry
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
already_consumed AS (
    SELECT EXISTS(
        SELECT 1 FROM grant_consumptions_entry gc
        WHERE gc.grant_id = (SELECT grant_id FROM params)
          AND gc.active = true
    ) as is_consumed
),
validity AS (
    SELECT
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM grant_row) THEN false
            WHEN (SELECT is_consumed FROM already_consumed) THEN false
            WHEN (SELECT expires_at FROM grant_row) <= NOW() THEN false
            ELSE true
        END as ok
),
reason_computed AS (
    SELECT
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM grant_row) THEN 'Grant not found'::text
            WHEN (SELECT is_consumed FROM already_consumed) THEN 'Grant already used'::text
            WHEN (SELECT expires_at FROM grant_row) <= NOW() THEN 'Grant expired'::text
            ELSE NULL::text
        END as reason
),
grant_consumed AS (
    INSERT INTO grant_consumptions_entry (grant_id)
    SELECT (SELECT grant_id FROM params)
    WHERE (SELECT ok FROM validity) = true
    RETURNING id
)
SELECT
    (SELECT ok FROM validity) as ok,
    (SELECT reason FROM reason_computed) as reason,
    (SELECT pgj.profile_id FROM profiles_grants_connection pgj WHERE pgj.grant_id = (SELECT grant_id FROM params) LIMIT 1) as actor_profile_id,
    (SELECT pej.profile_id FROM emulations_entry em JOIN profiles_emulations_connection pej ON pej.emulation_id = em.id WHERE em.grant_id = (SELECT grant_id FROM params) LIMIT 1) as target_profile_id
$$;
