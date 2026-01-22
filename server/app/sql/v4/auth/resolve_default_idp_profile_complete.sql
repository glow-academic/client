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
    profile_id uuid
)
RETURNS TABLE (
    profile_id uuid,
    primary_email text,
    name text,
    role profile_role
)
LANGUAGE sql
STABLE
AS $$
    WITH resolved_profile AS (
        SELECT 
            profile_id as resolved_profile_id
        WHERE profile_id IS NOT NULL
    ),
    profile_with_details AS (
        SELECT 
            rp.resolved_profile_id as profile_id,
            -- Get primary email (must match exactly what's in profile_emails table)
            (SELECT e.email 
             FROM profile_emails pe 
             JOIN emails_resource e ON pe.email_id = e.id 
             WHERE pe.profile_id = rp.resolved_profile_id 
               AND pe.is_primary = true 
               AND pe.active = true 
             LIMIT 1) as primary_email,
            -- Get name
            (SELECT n.name 
             FROM profile_names pn 
             JOIN names_resource n ON pn.name_id = n.id 
             WHERE pn.profile_id = rp.resolved_profile_id 
             LIMIT 1) as name,
            -- Get role
            (SELECT r.role 
             FROM profile_roles pr 
             JOIN roles_resource r ON pr.role_id = r.id 
             WHERE pr.profile_id = rp.resolved_profile_id 
             LIMIT 1) as role
        FROM resolved_profile rp
        WHERE rp.resolved_profile_id IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM setting_profiles sp
              JOIN setting_artifact s ON s.id = sp.setting_id
              WHERE sp.profile_id = rp.resolved_profile_id
                AND sp.active = true
                AND EXISTS (
                    SELECT 1
                    FROM setting_flags sf
                    JOIN flags_resource f ON sf.flag_id = f.id
                    WHERE sf.setting_id = s.id
                      AND f.name = 'setting_active'
                      AND sf.value = true
                )
          )
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
