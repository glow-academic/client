-- Get realm name for a department: settings_id if dept has keys, else 'master'
-- Simplified version matching get_login_data_complete.sql logic
SELECT 
    CASE 
        -- No department → master realm
        WHEN $1::uuid IS NULL THEN 'master'::text
        -- Check if department-specific settings has keys
        WHEN EXISTS (
            SELECT 1 
            FROM department_settings ds
            JOIN settings s ON s.id = ds.settings_id AND s.active = true
            JOIN setting_auth_keys sak ON sak.settings_id = s.id AND sak.active = true
            WHERE ds.department_id = $1::uuid AND ds.active = true
        ) THEN (
            -- Department settings has keys → use settings_id as realm
            SELECT s.id::text
            FROM department_settings ds
            JOIN settings s ON s.id = ds.settings_id AND s.active = true
            WHERE ds.department_id = $1::uuid AND ds.active = true
            LIMIT 1
        )
        -- No keys in dept settings → use master realm
        ELSE 'master'::text
    END as realm_name;

