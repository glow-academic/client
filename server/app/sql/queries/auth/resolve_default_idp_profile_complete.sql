-- Resolve profile ID, primary email, name, and role FROM profile_id
-- For use by custom OIDC Identity Provider (default-idp)
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS api_resolve_default_idp_profile_v4(uuid);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_resolve_default_idp_profile_v4(
    p_profile_id uuid
)
RETURNS TABLE (
    profile_id uuid,
    primary_email text,
    name text,
    role profile_type
)
LANGUAGE sql
STABLE
AS $$
    WITH resolved_profile AS (
        -- Resolve to the actual profile_artifact.id
        -- Input may be a profile_artifact.id directly, or a profiles_resource.id
        -- (from setting_profiles_junction which stores profiles_resource IDs)
        SELECT COALESCE(
            -- Try direct match on profile_artifact first
            (SELECT pa.id FROM profile_artifact pa WHERE pa.id = p_profile_id),
            -- Fall back to resolving via profile_profiles_junction (profiles_resource.id -> profile_artifact.id)
            (SELECT ppj.profile_id FROM profile_profiles_junction ppj WHERE ppj.profile_id = p_profile_id LIMIT 1)
        ) as resolved_profile_id
        WHERE p_profile_id IS NOT NULL
    ),
    profile_with_details AS (
        SELECT
            rp.resolved_profile_id as profile_id,
            -- Get primary email (must match exactly what's in profile_emails_junction table)
            (SELECT e.email
             FROM profile_emails_junction pe
             JOIN emails_resource e ON pe.emails_id = e.id
             WHERE pe.profile_id = rp.resolved_profile_id
               AND pe.is_primary = true
               AND pe.active = true
             LIMIT 1) as primary_email,
            -- Get name
            (SELECT n.name
             FROM profile_names_junction pn
             JOIN names_resource n ON pn.names_id = n.id
             WHERE pn.profile_id = rp.resolved_profile_id
             LIMIT 1) as name,
            -- Get role
            (SELECT r.role
             FROM profile_roles_junction pr
             JOIN roles_resource r ON pr.roles_id = r.id
             WHERE pr.profile_id = rp.resolved_profile_id
             LIMIT 1) as role
        FROM resolved_profile rp
        WHERE rp.resolved_profile_id IS NOT NULL
    )
    SELECT
        profile_id,
        primary_email,
        name,
        role
    FROM profile_with_details
    WHERE profile_id IS NOT NULL
      AND primary_email IS NOT NULL
    LIMIT 1
$$;
