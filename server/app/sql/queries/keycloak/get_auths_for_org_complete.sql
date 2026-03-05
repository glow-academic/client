-- Get auths for a specific department (org-scoped IdPs)
-- Resource-first path: departments_resource.setting_ids -> settings_resource.auth_ids -> auths_resource
-- Returns auth_artifact.id as `id` (stable, used in Keycloak aliases and providers.ftl)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infra_get_auths_for_org_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_get_auths_for_org_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION infra_get_auths_for_org_v4(
    department_id uuid
)
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
    FROM departments_resource dr
    JOIN department_departments_junction ddj ON ddj.department_id = dr.id
    CROSS JOIN LATERAL UNNEST(dr.setting_ids) AS s_id
    JOIN settings_resource sr ON sr.id = s_id AND sr.active = true
    CROSS JOIN LATERAL UNNEST(sr.auth_ids) AS a_id
    JOIN auths_resource ar ON ar.id = a_id AND ar.active = true
    JOIN auth_auths_junction aaj ON aaj.auth_id = ar.id
    WHERE ddj.department_id = infra_get_auths_for_org_v4.department_id
    ORDER BY ar.slug
$$;
