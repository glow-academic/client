-- Get auths from default settings (realm-level IdPs)
-- Resource-first path: settings_resource (not linked to any department) -> auth_ids -> auths_resource
-- Returns auth_artifact.id as `id` (stable, used in Keycloak aliases and providers.ftl)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infra_get_auths_for_realm_level_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_get_auths_for_realm_level_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION infra_get_auths_for_realm_level_v4()
RETURNS TABLE (
    id uuid,
    slug text,
    provider_id text,
    name text
)
LANGUAGE sql
STABLE
AS $$
    SELECT DISTINCT
        aaj.auth_id as id,
        ar.slug,
        ar.protocol as provider_id,
        ar.name
    FROM settings_resource sr
    CROSS JOIN LATERAL UNNEST(sr.auth_ids) AS a_id
    JOIN auths_resource ar ON ar.id = a_id AND ar.active = true
    JOIN auth_auths_junction aaj ON aaj.auths_id = ar.id
    WHERE sr.active = true
      AND NOT EXISTS (
          SELECT 1 FROM departments_resource dr
          WHERE sr.id = ANY(dr.setting_ids)
      )
    ORDER BY ar.slug
$$;
