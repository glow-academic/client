-- Resolve profile ID from department-id + auth-mode cookies
WITH resolve_profile_from_department AS (
    SELECT 
        CASE 
            WHEN $2::text = 'default-guest' THEN
                COALESCE(
                    -- Try department-specific settings first (only if department_id is provided)
                    CASE 
                        WHEN $1::text IS NOT NULL AND $1::text != '' THEN
                            (SELECT sdg.profile_id
                             FROM settings s
                             JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                             JOIN settings_default_guest sdg ON sdg.settings_id = s.id AND sdg.active = true
                             WHERE ds.department_id = $1::uuid AND s.active = true
                             LIMIT 1)
                        ELSE NULL::uuid
                    END,
                    -- Fallback to default settings (no department links) - always try this
                    (SELECT sdg.profile_id
                     FROM settings s
                     JOIN settings_default_guest sdg ON sdg.settings_id = s.id AND sdg.active = true
                     WHERE s.active = true
                       AND NOT EXISTS (
                           SELECT 1 FROM department_settings ds 
                           WHERE ds.settings_id = s.id AND ds.active = true
                       )
                     LIMIT 1)
                )
            WHEN $2::text = 'default-account' THEN
                COALESCE(
                    -- Try department-specific settings first (only if department_id is provided)
                    CASE 
                        WHEN $1::text IS NOT NULL AND $1::text != '' THEN
                            (SELECT sda.profile_id
                             FROM settings s
                             JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                             JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
                             WHERE ds.department_id = $1::uuid AND s.active = true
                             LIMIT 1)
                        ELSE NULL::uuid
                    END,
                    -- Fallback to default settings (no department links) - always try this
                    (SELECT sda.profile_id
                     FROM settings s
                     JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
                     WHERE s.active = true
                       AND NOT EXISTS (
                           SELECT 1 FROM department_settings ds 
                           WHERE ds.settings_id = s.id AND ds.active = true
                       )
                     LIMIT 1)
                )
        END as resolved_profile_id
)
SELECT resolved_profile_id::text FROM resolve_profile_from_department
WHERE resolved_profile_id IS NOT NULL

