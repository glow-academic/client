-- Get default model detail for creation with department and key mappings
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
        WHERE proname = 'api_get_model_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_model_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_model_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_model_new_v4_provider AS (
    provider_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_model_new_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_model_new_v4_model AS (
    model_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_model_new_v4_key AS (
    key_id uuid,
    name text,
    description text,
    key_masked text,
    active boolean,
    department_ids uuid[]
);

CREATE TYPE types.q_get_model_new_v4_unit AS (
    unit_id uuid,
    name text,
    unit_category text,
    value int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_model_new_v4(profile_id uuid)
RETURNS TABLE (
    valid_provider_ids uuid[],
    providers types.q_get_model_new_v4_provider[],
    valid_department_ids uuid[],
    departments types.q_get_model_new_v4_department[],
    valid_model_ids uuid[],
    models types.q_get_model_new_v4_model[],
    valid_key_ids uuid[],
    keys types.q_get_model_new_v4_key[],
    units types.q_get_model_new_v4_unit[],
    user_role text,
    primary_department_id uuid,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params)::uuid as profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = (SELECT profile_id FROM params)::uuid
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
user_departments_data AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE d.active = true
    AND pd.profile_id = rpi.resolved_profile_id
    AND pd.active = true
),
valid_models AS (
    -- Filter models by department: include if has matching department link OR has no department links at all (cross-dept)
    SELECT 
        m.id as model_id,
        m.name,
        COALESCE(m.description, '') as description
    FROM models m
    LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
    WHERE m.active = true
    GROUP BY m.id, m.name, m.description
    HAVING 
        COUNT(md.model_id) FILTER (WHERE md.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    ORDER BY m.name
),
valid_keys AS (
    -- Get all active keys (no model-specific filtering for default view)
    SELECT DISTINCT k.id as key_id, k.name, k.key, k.description, k.active
    FROM keys k
    WHERE k.active = true
),
profile_data AS (
    SELECT role as user_role 
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
primary_department_id AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
),
all_units_data AS (
    SELECT 
        id as unit_id,
        name,
        unit_category::text as unit_category,
        value
    FROM units
    WHERE active = true
    ORDER BY unit_category, value, name
),
providers_aggregated AS (
    SELECT 
        ARRAY_AGG(p.id ORDER BY p.name) as valid_provider_ids,
        ARRAY_AGG((p.id, p.name, COALESCE(p.description, ''))::types.q_get_model_new_v4_provider ORDER BY p.name) as providers
    FROM providers p
    WHERE p.active = true
),
departments_aggregated AS (
    SELECT 
        ARRAY_AGG(udd.id ORDER BY udd.id) as valid_department_ids,
        ARRAY_AGG((udd.id, udd.name, COALESCE(udd.description, ''))::types.q_get_model_new_v4_department ORDER BY udd.name) as departments
    FROM user_departments_data udd
),
models_aggregated AS (
    SELECT 
        ARRAY_AGG(vm.model_id ORDER BY vm.name) as valid_model_ids,
        ARRAY_AGG((vm.model_id, vm.name, vm.description)::types.q_get_model_new_v4_model ORDER BY vm.name) as models
    FROM valid_models vm
),
keys_aggregated AS (
    SELECT 
        ARRAY_AGG(vk.key_id ORDER BY vk.key_id) as valid_key_ids,
        ARRAY_AGG(
            (vk.key_id, vk.name, COALESCE(vk.description, ''),
             CASE 
                 WHEN LENGTH(vk.key) > 4 THEN LEFT(vk.key, 4) || '****'
                 ELSE '****'
             END,
             vk.active,
             ARRAY[]::uuid[]
            )::types.q_get_model_new_v4_key
            ORDER BY vk.name
        ) as keys
    FROM valid_keys vk
),
units_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (aud.unit_id, aud.name, aud.unit_category, aud.value)::types.q_get_model_new_v4_unit
            ORDER BY aud.unit_category, aud.value, aud.name
        ) as units
    FROM all_units_data aud
)
SELECT 
    COALESCE(pa.valid_provider_ids, ARRAY[]::uuid[]) as valid_provider_ids,
    COALESCE(pa.providers, '{}'::types.q_get_model_new_v4_provider[]) as providers,
    COALESCE(da.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(da.departments, '{}'::types.q_get_model_new_v4_department[]) as departments,
    COALESCE(ma.valid_model_ids, ARRAY[]::uuid[]) as valid_model_ids,
    COALESCE(ma.models, '{}'::types.q_get_model_new_v4_model[]) as models,
    COALESCE(ka.valid_key_ids, ARRAY[]::uuid[]) as valid_key_ids,
    COALESCE(ka.keys, '{}'::types.q_get_model_new_v4_key[]) as keys,
    COALESCE(ua.units, '{}'::types.q_get_model_new_v4_unit[]) as units,
    pr.user_role::text as user_role,
    pdi.department_id as primary_department_id,
    ap.actor_name::text as actor_name
FROM providers_aggregated pa
CROSS JOIN departments_aggregated da
CROSS JOIN models_aggregated ma
CROSS JOIN keys_aggregated ka
CROSS JOIN units_aggregated ua
CROSS JOIN profile_data pr
CROSS JOIN actor_profile ap
LEFT JOIN primary_department_id pdi ON true
$$;

COMMIT;
