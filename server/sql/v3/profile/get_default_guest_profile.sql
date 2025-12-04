-- Get default guest profile from settings system (default/active settings only)
SELECT 
    sdg.profile_id as id
FROM settings_default_guest sdg
JOIN settings s ON s.id = sdg.settings_id AND s.active = true
WHERE sdg.active = true
LIMIT 1

