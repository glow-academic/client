-- Get settings list with department_ids
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_settings_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_settings_list_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_settings_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_settings_list_v4_setting AS (
    settings_id uuid,
    created_at timestamptz,
    active boolean,
    name text,
    description text,
    department_ids text[]
);

CREATE TYPE types.q_get_settings_list_v4_key AS (
    key_id uuid,
    name text,
    key_masked text,
    description text,
    active boolean,
    department_ids text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_settings_list_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    settings types.q_get_settings_list_v4_setting[],
    keys types.q_get_settings_list_v4_key[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
settings_departments_data AS (
    SELECT 
        ds.settings_id,
        ARRAY_AGG(ds.department_id::text ORDER BY ds.created_at) as department_ids
    FROM department_settings ds
    WHERE ds.active = true
    GROUP BY ds.settings_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
user_profile AS (
    SELECT (SELECT r.role FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = profile_artifact.id 
            LIMIT 1) as role
    FROM params x
    JOIN profile_artifact ON profile_artifact.id = x.profile_id
),
-- Get department_ids via setting_provider_keys -> settings -> department_settings
key_departments_data AS (
    SELECT 
        spk.key_id,
        ARRAY_AGG(DISTINCT ds.department_id::text ORDER BY ds.department_id::text) as department_ids
    FROM setting_provider_keys spk
    JOIN setting_artifact s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE spk.active = true
    GROUP BY spk.key_id
),
settings_keys_data AS (
    -- Get all keys accessible to user (similar to keys/list logic)
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (kr.id, 
                 kr.name,
                 CASE 
                     WHEN LENGTH(kr.key) > 4 THEN LEFT(kr.key, 4) || '****'
                     ELSE '****'
                 END,
                 kr.description,
                 kr.active,
                 kdd.department_ids
                )::types.q_get_settings_list_v4_key
                ORDER BY kr.created_at DESC
            ),
            '{}'::types.q_get_settings_list_v4_key[]
        ) as keys
    FROM keys_resource kr
    LEFT JOIN key_departments_data kdd ON kdd.key_id = kr.id
    CROSS JOIN user_profile up
    WHERE 
        -- Include keys with matching department links OR default keys (no department links) OR superadmin can see all
        EXISTS (
            SELECT 1 FROM setting_provider_keys spk
            JOIN setting_artifact s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
            JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
            JOIN user_departments ud ON ud.department_id = ds.department_id
            WHERE spk.key_id = kr.id AND spk.active = true
        )
        OR NOT EXISTS (SELECT 1 FROM key_departments_data kdd2 WHERE kdd2.key_id = kr.id)
        OR up.role = 'superadmin'
)
SELECT 
    ap.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (s.id, s.created_at, EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE), (SELECT n.name FROM setting_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.setting_id = s.id LIMIT 1), (SELECT d.description FROM setting_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.setting_id = s.id LIMIT 1),
             COALESCE(sdd.department_ids, ARRAY[]::text[])
            )::types.q_get_settings_list_v4_setting
            ORDER BY s.created_at DESC
        ),
        '{}'::types.q_get_settings_list_v4_setting[]
    ) as settings,
    COALESCE(skd.keys, '{}'::types.q_get_settings_list_v4_key[]) as keys
FROM setting_artifact s
CROSS JOIN actor_profile ap
LEFT JOIN settings_departments_data sdd ON sdd.settings_id = s.id
LEFT JOIN settings_keys_data skd ON true
WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)  -- Only return active settings
GROUP BY ap.actor_name, skd.keys
$$;