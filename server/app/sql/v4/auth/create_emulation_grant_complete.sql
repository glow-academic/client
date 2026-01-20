-- Create emulation grant for default-idp flow
-- Uses safe drop/recreate pattern: drop function first, then recreate
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_emulation_grant_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_emulation_grant_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_emulation_grant_v4(
    requester_profile_id uuid,
    target_profile_id uuid,
    full_emulation boolean DEFAULT false,
    ttl_minutes integer DEFAULT 120,
    signin_base_url text DEFAULT NULL,
    callback_url text DEFAULT NULL,
    idp_alias text DEFAULT NULL
)
RETURNS TABLE (
    allowed boolean,
    reason text,
    actor_name text,
    grant_id uuid,
    expires_at timestamptz,
    target_profile_id uuid,
    redirect_url text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        requester_profile_id AS requester_profile_id,
        target_profile_id AS target_profile_id,
        COALESCE(full_emulation, false) AS full_emulation,
        COALESCE(ttl_minutes, 120) AS ttl_minutes,
        signin_base_url AS signin_base_url,
        callback_url AS callback_url,
        idp_alias AS idp_alias
),
requester_exists AS (
    SELECT EXISTS(
        SELECT 1 FROM profile_artifact
        WHERE id = (SELECT requester_profile_id FROM params)
    ) as exists
),
target_exists AS (
    SELECT EXISTS(
        SELECT 1 FROM profile_artifact
        WHERE id = (SELECT target_profile_id FROM params)
    ) as exists
),
self_emulation_check AS (
    SELECT
        CASE
            WHEN (SELECT requester_profile_id FROM params) = (SELECT target_profile_id FROM params) THEN true
            ELSE false
        END as is_self_emulation
),
requester_role AS (
    SELECT (SELECT r.role FROM profile_roles pr_j
            JOIN roles_resource r ON pr_j.role_id = r.id
            WHERE pr_j.profile_id = p.id
            LIMIT 1) as role
    FROM profile_artifact p
    WHERE p.id = (SELECT requester_profile_id FROM params)
),
simulatable_profiles AS (
    SELECT
        p.id
    FROM profile_artifact p
    CROSS JOIN requester_role rr
    WHERE p.id != (SELECT requester_profile_id FROM params)
      AND CASE
        WHEN rr.role = 'superadmin'::profile_role THEN true
        WHEN rr.role = 'admin'::profile_role THEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role, 'custom'::profile_role)
        WHEN rr.role = 'instructional'::profile_role THEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('member'::profile_role, 'guest'::profile_role)
        ELSE false
      END
),
target_in_simulatable AS (
    SELECT EXISTS(
        SELECT 1
        FROM simulatable_profiles sp
        WHERE sp.id = (SELECT target_profile_id FROM params)
    ) as is_simulatable
),
allowed_check AS (
    SELECT
        CASE
            WHEN NOT (SELECT exists FROM requester_exists) THEN false
            WHEN NOT (SELECT exists FROM target_exists) THEN false
            WHEN (SELECT is_self_emulation FROM self_emulation_check) THEN true
            WHEN (SELECT is_simulatable FROM target_in_simulatable) THEN true
            ELSE false
        END as allowed
),
reason_computed AS (
    SELECT
        CASE
            WHEN NOT (SELECT exists FROM requester_exists) THEN 'Requester profile not found'::text
            WHEN NOT (SELECT exists FROM target_exists) THEN 'Target profile not found'::text
            WHEN (SELECT allowed FROM allowed_check) THEN NULL::text
            ELSE 'You do not have permission to emulate this profile'::text
        END as reason
),
actor_name_computed AS (
    SELECT
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1)
            || ' ' ||
            (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id LIMIT 1),
            ''
        ) as actor_name
    FROM profile_artifact p
    WHERE p.id = (SELECT requester_profile_id FROM params)
),
grant_insert AS (
    INSERT INTO emulation_grants (
        id,
        actor_profile_id,
        target_profile_id,
        full_emulation,
        expires_at,
        created_at,
        updated_at
    )
    SELECT
        uuidv7(),
        (SELECT requester_profile_id FROM params),
        (SELECT target_profile_id FROM params),
        (SELECT full_emulation FROM params),
        NOW() + ((SELECT ttl_minutes FROM params) || ' minutes')::interval,
        NOW(),
        NOW()
    WHERE (SELECT allowed FROM allowed_check) = true
    RETURNING id, expires_at
)
SELECT
    (SELECT allowed FROM allowed_check) as allowed,
    (SELECT reason FROM reason_computed) as reason,
    (SELECT actor_name FROM actor_name_computed) as actor_name,
    (SELECT id FROM grant_insert) as grant_id,
    (SELECT expires_at FROM grant_insert) as expires_at,
    (SELECT target_profile_id FROM params) as target_profile_id,
    CASE
        WHEN (SELECT allowed FROM allowed_check) = true THEN
            (SELECT signin_base_url FROM params)
            || '?callbackUrl=' || (SELECT callback_url FROM params)
            || '&kc_idp_hint=' || (SELECT idp_alias FROM params)
            || '&login_hint=' || (SELECT id FROM grant_insert)::text
        ELSE NULL::text
    END as redirect_url
$$;
