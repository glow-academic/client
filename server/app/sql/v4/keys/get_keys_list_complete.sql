-- Get keys list with department relationships, model relationships, and permissions
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
        WHERE proname = 'api_get_keys_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_keys_list_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_keys_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_keys_list_v4_key AS (
    key_id uuid,
    name text,
    key_masked text,
    description text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz,
    department_ids text[],
    model_ids text[],
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean
);

CREATE TYPE types.q_get_keys_list_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_keys_list_v4_model AS (
    model_id uuid,
    name text,
    description text,
    provider text,
    active boolean
);

CREATE TYPE types.q_get_keys_list_v4_department_option AS (
    value text,
    label text
);

CREATE TYPE types.q_get_keys_list_v4_model_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_keys_list_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    keys types.q_get_keys_list_v4_key[],
    departments types.q_get_keys_list_v4_department[],
    models types.q_get_keys_list_v4_model[],
    department_options types.q_get_keys_list_v4_department_option[],
    model_options types.q_get_keys_list_v4_model_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
user_profile AS (
    SELECT 
        role,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
-- Get department_ids via setting_provider_keys -> settings -> department_settings
key_departments_data AS (
    SELECT 
        spk.key_id,
        ARRAY_AGG(DISTINCT ds.department_id::text ORDER BY ds.department_id::text) as department_ids
    FROM setting_provider_keys spk
    JOIN settings s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE spk.active = true
    GROUP BY spk.key_id
),
-- Get model_ids via setting_provider_keys -> providers -> models
key_models_data AS (
    SELECT 
        spk.key_id,
        ARRAY_AGG(m.id::text ORDER BY (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1)) as model_ids
    FROM setting_provider_keys spk
    JOIN providers p ON p.id = spk.provider_id
    JOIN model_providers mp ON mp.provider_id = p.id
    JOIN models m ON m.id = mp.model_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = true)
    GROUP BY spk.key_id
),
key_data AS (
    SELECT 
        k.id as key_id,
        (SELECT n.name FROM key_names kn JOIN names n ON kn.name_id = n.id WHERE kn.key_id = k.id LIMIT 1) as name,
        CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END as key_masked,
        COALESCE((SELECT d.description FROM key_descriptions kd JOIN descriptions d ON kd.description_id = d.id WHERE kd.key_id = k.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) as active,
        k.created_at,
        k.updated_at,
        COALESCE(kdd.department_ids, NULL) as department_ids,
        COALESCE(kmd.model_ids, ARRAY[]::text[]) as model_ids,
        CASE 
            -- Default keys (no department_ids) are read-only for non-superadmin
            WHEN COALESCE(kdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role = 'admin' AND (
                -- Check if key is linked to settings that are linked to user's departments
                EXISTS (
                    SELECT 1 FROM setting_provider_keys spk
                    JOIN settings s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
                    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                    JOIN user_departments ud ON ud.department_id = ds.department_id
                    WHERE spk.key_id = k.id AND spk.active = true
                )
                OR NOT EXISTS (SELECT 1 FROM key_departments_data kdd2 WHERE kdd2.key_id = k.id)
            ) THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Can't delete if can't edit
            WHEN COALESCE(kdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role = 'admin' AND (
                EXISTS (
                    SELECT 1 FROM setting_provider_keys spk
                    JOIN settings s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
                    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                    JOIN user_departments ud ON ud.department_id = ds.department_id
                    WHERE spk.key_id = k.id AND spk.active = true
                )
                OR NOT EXISTS (SELECT 1 FROM key_departments_data kdd2 WHERE kdd2.key_id = k.id)
            ) THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM keys k
    LEFT JOIN key_departments_data kdd ON kdd.key_id = k.id
    LEFT JOIN key_models_data kmd ON kmd.key_id = k.id
    CROSS JOIN user_profile up
    WHERE 
        -- Include keys with matching department links OR default keys (no department links)
        EXISTS (
            SELECT 1 FROM setting_provider_keys spk
            JOIN settings s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
            JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
            JOIN user_departments ud ON ud.department_id = ds.department_id
            WHERE spk.key_id = k.id AND spk.active = true
        )
        OR NOT EXISTS (SELECT 1 FROM key_departments_data kdd2 WHERE kdd2.key_id = k.id)
        OR up.role = 'superadmin'
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM key_departments_data
    WHERE department_ids IS NOT NULL
    UNION
    SELECT department_id FROM user_departments
),
all_model_ids AS (
    SELECT DISTINCT unnest(model_ids)::uuid as model_id
    FROM key_models_data
    WHERE model_ids IS NOT NULL
),
departments_data AS (
    SELECT DISTINCT
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1), '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
),
models_data AS (
    SELECT DISTINCT
        m.id as model_id,
        (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM model_descriptions md JOIN descriptions d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), '') as description,
        p.value as provider,
        EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = TRUE) as active
    FROM models m
    JOIN model_providers mp2 ON mp2.model_id = m.id
    JOIN providers p ON p.id = mp2.provider_id
    WHERE m.id IN (SELECT model_id FROM all_model_ids)
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (kd.key_id, kd.name, kd.key_masked, kd.description, kd.active, kd.created_at, kd.updated_at, 
             kd.department_ids, kd.model_ids, kd.can_edit, kd.can_delete, kd.can_duplicate
            )::types.q_get_keys_list_v4_key
            ORDER BY kd.created_at DESC
        ),
        '{}'::types.q_get_keys_list_v4_key[]
    ) as keys,
    COALESCE(
        ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_keys_list_v4_department
            ORDER BY dd.name
        ) FILTER (WHERE dd.department_id IS NOT NULL),
        '{}'::types.q_get_keys_list_v4_department[]
    ) as departments,
    COALESCE(
        ARRAY_AGG(
            (md.model_id, md.name, md.description, md.provider, md.active)::types.q_get_keys_list_v4_model
            ORDER BY md.name
        ) FILTER (WHERE md.model_id IS NOT NULL),
        '{}'::types.q_get_keys_list_v4_model[]
    ) as models,
    COALESCE(
        ARRAY_AGG(
            (dd.department_id::text, dd.name)::types.q_get_keys_list_v4_department_option
            ORDER BY dd.name
        ) FILTER (WHERE dd.department_id IS NOT NULL),
        '{}'::types.q_get_keys_list_v4_department_option[]
    ) as department_options,
    COALESCE(
        ARRAY_AGG(
            (md.model_id::text, md.name)::types.q_get_keys_list_v4_model_option
            ORDER BY md.name
        ) FILTER (WHERE md.model_id IS NOT NULL),
        '{}'::types.q_get_keys_list_v4_model_option[]
    ) as model_options
FROM key_data kd
CROSS JOIN user_profile up
CROSS JOIN departments_data dd
CROSS JOIN models_data md
GROUP BY up.actor_name
$$;