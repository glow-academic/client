-- Get auths for a specific department (org-scoped IdPs)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
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

-- Recreate function
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
    WITH dept_settings AS (
        -- Get department-specific settings
        SELECT DISTINCT s.id as settings_id
        FROM setting_artifact s
        JOIN department_settings_junction ds ON ds.settings_id = s.id AND ds.active = true
        WHERE ds.department_id = infra_get_auths_for_org_v4.department_id
          AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
    ),
    settings_auths AS (
        -- Get auths linked to department settings
        SELECT DISTINCT ar.id
        FROM auths_resource ar
        JOIN setting_auths_junction sa ON sa.auth_id = ar.id AND sa.active = true
        JOIN dept_settings ds ON sa.settings_id = ds.settings_id
        WHERE EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = ar.auth_id AND f.name = 'auth_active' AND af.value = true)
          AND ds.settings_id IS NOT NULL
    )
    -- Return providers for department settings (org-scoped)
    SELECT DISTINCT
        ar.auth_id as id, 
        (SELECT s.value FROM auth_slugs_junction as_j JOIN slugs_resource s ON s.id = as_j.slug_id WHERE as_j.auth_id = ar.auth_id LIMIT 1) as slug, 
        (SELECT p.value FROM auth_protocols_junction ap JOIN protocols_resource p ON p.id = ap.protocol_id WHERE ap.auth_id = ar.auth_id LIMIT 1) as provider_id, 
        (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = ar.auth_id LIMIT 1) as name
    FROM auths_resource ar
    WHERE EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = ar.auth_id AND f.name = 'auth_active' AND af.value = true)
      AND EXISTS (SELECT 1 FROM settings_auths sa WHERE sa.id = ar.id)
    ORDER BY slug
$$;
