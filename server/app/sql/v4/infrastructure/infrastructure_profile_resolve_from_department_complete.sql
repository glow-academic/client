-- Resolve profile ID FROM department_artifact-id + auth-mode cookies
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS infra_resolve_from_department_profile_v4(text, text);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION infra_resolve_from_department_profile_v4(
    department_id text,
    auth_mode text
)
RETURNS TABLE (
    resolved_profile_id uuid
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
                                (SELECT dar.profile_id
                                 FROM setting_artifact s
                                 JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                 JOIN setting_default_accounts sda ON sda.setting_id = s.id AND sda.active = true
                                 JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                                 WHERE ds.department_id = department_id::uuid 
                                 AND dar.type = 'guest'::default_account_type
                                 AND dar.active = true
                                 AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true)
                                 LIMIT 1)
                            ELSE NULL::uuid
                        END,
                        -- Fallback to default settings (no department links) - always try this
                        (SELECT dar.profile_id
                         FROM setting_artifact s
                         JOIN setting_default_accounts sda ON sda.setting_id = s.id AND sda.active = true
                         JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                         WHERE dar.type = 'guest'::default_account_type
                         AND dar.active = true
                         AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true)
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
                                (SELECT dar.profile_id
                                 FROM setting_artifact s
                                 JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                 JOIN setting_default_accounts sda ON sda.setting_id = s.id AND sda.active = true
                                 JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                                 WHERE ds.department_id = department_id::uuid 
                                 AND dar.type = 'admin'::default_account_type
                                 AND dar.active = true
                                 AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true)
                                 LIMIT 1)
                            ELSE NULL::uuid
                        END,
                        -- Fallback to default settings (no department links) - always try this
                        (SELECT dar.profile_id
                         FROM setting_artifact s
                         JOIN setting_default_accounts sda ON sda.setting_id = s.id AND sda.active = true
                         JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                         WHERE dar.type = 'admin'::default_account_type
                         AND dar.active = true
                         AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true)
                           AND NOT EXISTS (
                               SELECT 1 FROM department_settings ds 
                               WHERE ds.settings_id = s.id AND ds.active = true
                           )
                         LIMIT 1)
                    )
            END as resolved_profile_id
    )
    SELECT resolved_profile_id FROM resolve_profile_from_department
    WHERE resolved_profile_id IS NOT NULL;
$$;