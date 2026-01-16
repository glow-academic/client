-- Resolve profile ID, primary email, name, and role FROM department-id + auth-mode
-- For use by custom OIDC Identity Provider
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS api_resolve_default_idp_profile_v4(text, text);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_resolve_default_idp_profile_v4(
    department_id text,
    auth_mode text
)
RETURNS TABLE (
    profile_id uuid,
    primary_email text,
    first_name text,
    last_name text,
    role profile_role
)
LANGUAGE sql
STABLE
AS $$
    WITH resolve_profile_from_department AS (
        SELECT 
            CASE 
                WHEN auth_mode = 'default-guest' THEN
                    COALESCE(
                        -- Try department-specific settings first (only if department_id is provided)
                        CASE 
                            WHEN department_id IS NOT NULL AND department_id != '' THEN
                                (SELECT sdg.profile_id
                                 FROM setting_artifact s
                                 JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                 JOIN settings_default_guest sdg ON sdg.settings_id = s.id AND sdg.active = true
                                 WHERE ds.department_id = department_id::uuid AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'active' AND sf.value = true)
                                 LIMIT 1)
                            ELSE NULL::uuid
                        END,
                        -- Fallback to default settings (no department links) - always try this
                        (SELECT sdg.profile_id
                         FROM setting_artifact s
                         JOIN settings_default_guest sdg ON sdg.settings_id = s.id AND sdg.active = true
                         WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'active' AND sf.value = true)
                           AND NOT EXISTS (
                               SELECT 1 FROM department_settings ds 
                               WHERE ds.settings_id = s.id AND ds.active = true
                           )
                         LIMIT 1)
                    )
                WHEN auth_mode = 'default-account' THEN
                    COALESCE(
                        -- Try department-specific settings first (only if department_id is provided)
                        CASE 
                            WHEN department_id IS NOT NULL AND department_id != '' THEN
                                (SELECT sda.profile_id
                                 FROM setting_artifact s
                                 JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                 JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
                                 WHERE ds.department_id = department_id::uuid AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'active' AND sf.value = true)
                                 LIMIT 1)
                            ELSE NULL::uuid
                        END,
                        -- Fallback to default settings (no department links) - always try this
                        (SELECT sda.profile_id
                         FROM setting_artifact s
                         JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
                         WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'active' AND sf.value = true)
                           AND NOT EXISTS (
                               SELECT 1 FROM department_settings ds 
                               WHERE ds.settings_id = s.id AND ds.active = true
                           )
                         LIMIT 1)
                    )
            END as resolved_profile_id
    ),
    profile_with_details AS (
        SELECT 
            rpfd.resolved_profile_id as profile_id,
            -- Get primary email (must match exactly what's in profile_emails table)
            (SELECT e.email 
             FROM profile_emails pe 
             JOIN emails_resource e ON pe.email_id = e.id 
             WHERE pe.profile_id = rpfd.resolved_profile_id 
               AND pe.is_primary = true 
               AND pe.active = true 
             LIMIT 1) as primary_email,
            -- Get first name
            (SELECT n.name 
             FROM profile_names pn 
             JOIN names_resource n ON pn.name_id = n.id 
             WHERE pn.profile_id = rpfd.resolved_profile_id 
               AND pn.type = 'first' 
             LIMIT 1) as first_name,
            -- Get last name
            (SELECT n2.name 
             FROM profile_names pn2 
             JOIN names_resource n2 ON pn2.name_id = n2.id 
             WHERE pn2.profile_id = rpfd.resolved_profile_id 
               AND pn2.type = 'last' 
             LIMIT 1) as last_name,
            -- Get role
            (SELECT r.role 
             FROM profile_roles pr 
             JOIN roles_resource r ON pr.role_id = r.id 
             WHERE pr.profile_id = rpfd.resolved_profile_id 
             LIMIT 1) as role
        FROM resolve_profile_from_department rpfd
        WHERE rpfd.resolved_profile_id IS NOT NULL
    )
    SELECT 
        profile_id,
        primary_email,
        first_name,
        last_name,
        role
    FROM profile_with_details
    WHERE profile_id IS NOT NULL
      AND primary_email IS NOT NULL
    LIMIT 1
$$;
