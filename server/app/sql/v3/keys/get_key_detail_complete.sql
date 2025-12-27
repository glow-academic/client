-- Get key detail with department relationships, model relationships, and permissions
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_key_detail_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_key_detail_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_key_detail_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_key_detail_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_key_detail_v3_model AS (
    model_id uuid,
    name text,
    description text,
    provider text,
    active boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_key_detail_v3(key_id uuid, profile_id uuid)
RETURNS TABLE (
    key_exists boolean,
    key_id uuid,
    name text,
    key_masked text,
    type text,
    description text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz,
    department_ids text[],
    model_ids text[],
    valid_department_ids text[],
    can_edit boolean,
    departments types.q_get_key_detail_v3_department[],
    models types.q_get_key_detail_v3_model[],
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT key_id AS key_id, profile_id AS profile_id
),
key_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM keys WHERE id = (SELECT key_id FROM params)
    )::boolean as key_exists
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
key_data AS (
    SELECT 
        k.id as key_id,
        k.name,
        CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END as key_masked,
        k.description,
        k.active,
        k.created_at,
        k.updated_at
    FROM params x
    JOIN keys k ON k.id = x.key_id
),
-- Get department_ids via setting_provider_keys -> settings -> department_settings
key_departments_data AS (
    SELECT 
        ARRAY_AGG(DISTINCT ds.department_id::text ORDER BY ds.department_id::text) as department_ids
    FROM params x
    JOIN setting_provider_keys spk ON spk.key_id = x.key_id AND spk.active = true
    JOIN settings s ON s.id = spk.settings_id AND s.active = true
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
),
-- Get model_ids via setting_provider_keys -> providers -> models
key_models_data AS (
    SELECT 
        ARRAY_AGG(m.id::text ORDER BY m.name) as model_ids
    FROM params x
    JOIN setting_provider_keys spk ON spk.key_id = x.key_id AND spk.active = true
    JOIN providers p ON p.id = spk.provider_id
    JOIN models m ON m.provider_id = p.id AND m.active = true
),
valid_depts AS (
    SELECT 
        ARRAY_AGG(d.id::text ORDER BY d.title) as dept_ids
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
    JOIN departments d ON d.id = pd.department_id AND d.active = true
),
departments_data AS (
    SELECT DISTINCT
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
    JOIN departments d ON d.id = pd.department_id AND d.active = true
),
models_data AS (
    SELECT DISTINCT
        m.id as model_id,
        m.name,
        COALESCE(m.description, '') as description,
        p.value as provider,
        m.active
    FROM params x
    JOIN setting_provider_keys spk ON spk.key_id = x.key_id AND spk.active = true
    JOIN providers p ON p.id = spk.provider_id
    JOIN models m ON m.provider_id = p.id AND m.active = true
),
profile_data AS (
    SELECT role as user_role 
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_has_key_access AS (
    -- Check if user has access to key via setting_provider_keys -> settings -> department_settings
    SELECT EXISTS(
        SELECT 1 FROM params x
        JOIN setting_provider_keys spk ON spk.key_id = x.key_id AND spk.active = true
        JOIN settings s ON s.id = spk.settings_id AND s.active = true
        JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
        JOIN profile_departments pd ON pd.department_id = ds.department_id AND pd.active = true
        WHERE pd.profile_id = x.profile_id
    ) OR EXISTS(
        SELECT 1 FROM params x
        JOIN profiles p ON p.id = x.profile_id
        WHERE p.role = 'superadmin'
    ) OR (
        -- Default keys (no department links via settings) are accessible to all admins
        NOT EXISTS (
            SELECT 1 FROM params x
            JOIN setting_provider_keys spk ON spk.key_id = x.key_id AND spk.active = true
            JOIN settings s ON s.id = spk.settings_id AND s.active = true
            JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
        )
    ) as has_access
)
SELECT 
    kec.key_exists::boolean as key_exists,
    kd.key_id::uuid as key_id,
    kd.name::text as name,
    kd.key_masked::text as key_masked,
    'api'::text as type,
    kd.description::text as description,
    kd.active::boolean as active,
    kd.created_at::timestamptz as created_at,
    kd.updated_at::timestamptz as updated_at,
    COALESCE(kdd.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(kmd.model_ids, ARRAY[]::text[]) as model_ids,
    COALESCE(vd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    CASE 
        -- Default keys (no department_ids via settings) are read-only for non-superadmin
        WHEN (COALESCE(kdd.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND pr.user_role != 'superadmin') THEN false
        WHEN pr.user_role = 'superadmin' THEN true
        WHEN pr.user_role = 'admin' AND uhka.has_access THEN true
        ELSE false
    END::boolean as can_edit,
    COALESCE(
        ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_key_detail_v3_department
            ORDER BY dd.name
        ) FILTER (WHERE dd.department_id IS NOT NULL),
        '{}'::types.q_get_key_detail_v3_department[]
    ) as departments,
    COALESCE(
        ARRAY_AGG(
            (md.model_id, md.name, md.description, md.provider, md.active)::types.q_get_key_detail_v3_model
            ORDER BY md.name
        ) FILTER (WHERE md.model_id IS NOT NULL),
        '{}'::types.q_get_key_detail_v3_model[]
    ) as models,
    ap.actor_name::text as actor_name
FROM key_exists_check kec
CROSS JOIN key_data kd
LEFT JOIN key_departments_data kdd ON true
LEFT JOIN key_models_data kmd ON true
CROSS JOIN valid_depts vd
CROSS JOIN profile_data pr
CROSS JOIN user_has_key_access uhka
CROSS JOIN departments_data dd
CROSS JOIN models_data md
CROSS JOIN actor_profile ap
WHERE uhka.has_access = true
GROUP BY kec.key_exists, kd.key_id, kd.name, kd.key_masked, kd.description, kd.active, 
         kd.created_at, kd.updated_at, kdd.department_ids, kmd.model_ids, vd.dept_ids, 
         pr.user_role, uhka.has_access, ap.actor_name
$$;

COMMIT;
