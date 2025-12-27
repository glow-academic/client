-- Get department detail with permissions, stats, and settings
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
        WHERE proname = 'api_get_department_detail_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_department_detail_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_department_detail_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_department_detail_v3_setting AS (
    settings_id uuid,
    created_at timestamptz,
    active boolean,
    department_ids uuid[]
);

CREATE TYPE types.q_get_department_detail_v3_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_department_detail_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_department_detail_v3_model AS (
    model_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_department_detail_v3_key AS (
    key_id uuid,
    name text,
    description text,
    key_masked text,
    active boolean
);

CREATE TYPE types.q_get_department_detail_v3_model_key AS (
    model_id uuid,
    key_id uuid
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_department_detail_v3(
    department_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    department_exists boolean,
    department_id uuid,
    title text,
    description text,
    active boolean,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    in_use boolean,
    staff_count int,
    total_price_spent float,
    settings_id uuid,
    valid_department_ids uuid[],
    valid_model_ids uuid[],
    valid_key_ids uuid[],
    actor_name text,
    settings types.q_get_department_detail_v3_setting[],
    cohorts types.q_get_department_detail_v3_cohort[],
    departments types.q_get_department_detail_v3_department[],
    models types.q_get_department_detail_v3_model[],
    keys types.q_get_department_detail_v3_key[],
    model_keys types.q_get_department_detail_v3_model_key[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT department_id AS department_id,
           profile_id AS profile_id
),
department_exists_check AS (
    -- Check if department exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM departments WHERE id = (SELECT department_id FROM params)
    )::boolean as department_exists
),
-- First, find runs for this department (filter first, then calculate costs)
runs_for_department_via_agents AS (
    SELECT DISTINCT mr.id as run_id
    FROM runs mr
    JOIN agent_departments ad ON ad.agent_id = mr.agent_id AND ad.active = true
    WHERE ad.department_id = (SELECT department_id FROM params) AND mr.agent_id IS NOT NULL
),
runs_for_department_via_personas AS (
    SELECT DISTINCT mr.id as run_id
    FROM runs mr
    JOIN run_personas mrp ON mrp.run_id = mr.id AND mrp.active = true
    JOIN persona_departments pd ON pd.persona_id = mrp.persona_id AND pd.active = true
    WHERE pd.department_id = (SELECT department_id FROM params)
),
runs_for_department_via_profiles AS (
    SELECT DISTINCT mr.id as run_id
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id AND mrp.active = true
    JOIN profile_departments pd ON pd.profile_id = mrp.profile_id AND pd.active = true
    WHERE pd.department_id = (SELECT department_id FROM params)
),
runs_for_department AS (
    SELECT run_id FROM runs_for_department_via_agents
    UNION
    SELECT run_id FROM runs_for_department_via_personas
    UNION
    SELECT run_id FROM runs_for_department_via_profiles
),
-- Calculate costs only for runs in this department (much faster)
model_run_costs AS (
    SELECT 
        rpu.run_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * mp.price
        ), 0) as cost
    FROM run_pricing_usage rpu
    JOIN runs_for_department rfd ON rfd.run_id = rpu.run_id
    JOIN run_models rm ON rm.run_id = rpu.run_id AND rm.active = true
    JOIN model_pricing mp ON mp.model_id = rm.model_id 
        AND mp.pricing_type = rpu.pricing_type 
        AND mp.unit_id = rpu.unit_id
        AND mp.active = true
    JOIN units u ON u.id = rpu.unit_id
    GROUP BY rpu.run_id
),
department_price_spent AS (
    SELECT 
        (SELECT department_id FROM params) as department_id,
        COALESCE(SUM(mrc.cost), 0) as total_price_spent
    FROM model_run_costs mrc
),
department_staff_count AS (
    SELECT 
        department_id, 
        COUNT(DISTINCT profile_id) as staff_count
    FROM profile_departments
    WHERE department_id = (SELECT department_id FROM params) AND active = true
    GROUP BY department_id
),
department_usage AS (
    SELECT
        (SELECT COUNT(*) FROM profile_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM simulation_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM scenario_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM persona_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM document_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM cohort_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) as total_usage
),
user_profile AS (
    SELECT 
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
user_department_access AS (
    -- Check if user has access to this department
    SELECT EXISTS(
        SELECT 1 FROM profile_departments pd
        WHERE pd.profile_id = (SELECT profile_id FROM params) AND pd.department_id = (SELECT department_id FROM params) AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM profiles p WHERE p.id = (SELECT profile_id FROM params) AND p.role = 'superadmin'
    ) as has_access
),
-- Only get cohorts/departments for the current user's profile (much faster)
user_profile_cohorts AS (
    SELECT 
        ARRAY_AGG(cp.cohort_id ORDER BY c.title) as cohort_ids
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    WHERE cp.profile_id = (SELECT profile_id FROM params) AND cp.active = true
),
user_profile_departments AS (
    SELECT 
        ARRAY_AGG(pd.department_id ORDER BY d.title) as department_ids
    FROM profile_departments pd
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT profile_id FROM params) AND pd.active = true
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids) as cohort_id
    FROM user_profile_cohorts
    WHERE cohort_ids IS NOT NULL AND array_length(cohort_ids, 1) > 0
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM user_profile_departments
    WHERE department_ids IS NOT NULL AND array_length(department_ids, 1) > 0
),
department_current_settings AS (
    -- Get current settings_id for this department (department-specific first, then default)
    SELECT COALESCE(
        -- Department-specific settings for this department
        (SELECT ds.settings_id
         FROM department_settings ds
         WHERE ds.department_id = (SELECT department_id FROM params) AND ds.active = true
         LIMIT 1),
        -- Fallback to default settings (no department links)
        (SELECT s.id
         FROM settings s
         WHERE s.active = true
         AND NOT EXISTS (
             SELECT 1 FROM department_settings ds2 
             WHERE ds2.settings_id = s.id 
             AND ds2.active = true
         )
         ORDER BY s.created_at DESC
         LIMIT 1)
    ) as settings_id
),
settings_departments_data AS (
    -- Get department_ids for each setting
    SELECT 
        ds.settings_id,
        CASE 
            WHEN COUNT(ds.department_id) > 0 THEN ARRAY_AGG(ds.department_id ORDER BY ds.created_at) FILTER (WHERE ds.department_id IS NOT NULL)
            ELSE ARRAY[]::uuid[]
        END as department_ids
    FROM department_settings ds
    WHERE ds.active = true
    GROUP BY ds.settings_id
),
settings_data AS (
    -- Only return department-specific settings for this department + default settings
    SELECT DISTINCT
        s.id as settings_id,
        s.created_at,
        s.active,
        COALESCE(sdd.department_ids, ARRAY[]::uuid[]) as department_ids
    FROM settings s
    LEFT JOIN settings_departments_data sdd ON sdd.settings_id = s.id
    WHERE s.active = true
    AND (
        -- Include department-specific settings for this department
        EXISTS (
            SELECT 1 FROM department_settings ds 
            WHERE ds.settings_id = s.id 
            AND ds.department_id = (SELECT department_id FROM params) 
            AND ds.active = true
        )
        OR
        -- Include default settings (no department links)
        NOT EXISTS (
            SELECT 1 FROM department_settings ds2 
            WHERE ds2.settings_id = s.id 
            AND ds2.active = true
        )
    )
),
cohorts_data AS (
    SELECT DISTINCT
        c.id as cohort_id,
        c.title as name,
        COALESCE(c.description, '') as description
    FROM cohorts c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
departments_data AS (
    SELECT DISTINCT
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM departments d
    WHERE (d.id = (SELECT department_id FROM params) OR EXISTS (SELECT 1 FROM all_department_ids WHERE department_id = d.id))
    AND d.active = true
),
keys_data AS (
    -- Get all API keys available to this department via settings
    SELECT DISTINCT 
        k.id as key_id, 
        k.name, 
        CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END as key_masked,
        CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END as description,
        k.active
    FROM keys k
    JOIN setting_provider_keys spk ON spk.key_id = k.id AND spk.active = true
    JOIN settings s ON s.id = spk.settings_id AND s.active = true
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE k.active = true
    AND ds.department_id = (SELECT department_id FROM params)
    AND ds.active = true
    UNION
    -- Also include all active keys (general access)
    SELECT DISTINCT 
        k.id as key_id, 
        k.name, 
        CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END as key_masked,
        CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END as description,
        k.active
    FROM keys k
    WHERE k.active = true
),
-- Get model-key associations using JOIN instead of correlated subquery (much faster)
department_settings_for_model_keys AS (
    SELECT DISTINCT ds.settings_id
    FROM department_settings ds
    WHERE ds.department_id = (SELECT department_id FROM params) AND ds.active = true
),
department_models AS (
    -- Get all models available to this department (default + department-specific)
    SELECT DISTINCT
        m.id as model_id,
        m.name,
        COALESCE(m.description, '') as description,
        m.active,
        m.provider_id
    FROM models m
    LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
    WHERE m.active = true
    AND (
        md.department_id = (SELECT department_id FROM params)
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    )
),
model_key_associations AS (
    SELECT DISTINCT
        dm.model_id,
        spk.key_id
    FROM department_models dm
    LEFT JOIN department_settings_for_model_keys dsfmk ON true
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = dm.provider_id 
        AND spk.settings_id = dsfmk.settings_id 
        AND spk.active = true
    WHERE spk.key_id IS NOT NULL
)
SELECT 
    -- Department existence check (always returned)
    dec.department_exists::boolean as department_exists,
    -- Top-level department fields
    d.id as department_id,
    d.title::text as title,
    d.description::text as description,
    d.active::boolean as active,
    CASE 
        WHEN up.role = 'superadmin' THEN true
        WHEN up.role = 'admin' AND uda.has_access THEN true
        ELSE false
    END::boolean as can_edit,
    CASE WHEN up.role = 'superadmin' THEN true ELSE false END::boolean as can_duplicate,
    CASE 
        WHEN up.role = 'superadmin' AND du.total_usage = 0 THEN true
        ELSE false
    END::boolean as can_delete,
    CASE WHEN du.total_usage > 0 THEN true ELSE false END::boolean as in_use,
    COALESCE(dsc.staff_count, 0)::int as staff_count,
    COALESCE(dps.total_price_spent, 0)::float as total_price_spent,
    dcs.settings_id as settings_id,
    COALESCE((SELECT array_agg(department_id ORDER BY name) FROM departments_data), ARRAY[]::uuid[])::uuid[] as valid_department_ids,
    COALESCE((SELECT array_agg(model_id ORDER BY name) FROM department_models), ARRAY[]::uuid[])::uuid[] as valid_model_ids,
    COALESCE((SELECT array_agg(key_id ORDER BY name) FROM keys_data), ARRAY[]::uuid[])::uuid[] as valid_key_ids,
    up.actor_name::text as actor_name,
    -- Aggregated arrays
    COALESCE(
        ARRAY_AGG(
            (sd.settings_id, sd.created_at, sd.active, sd.department_ids)::types.q_get_department_detail_v3_setting
            ORDER BY sd.created_at DESC
        ) FILTER (WHERE uda.has_access = true AND sd.settings_id IS NOT NULL),
        '{}'::types.q_get_department_detail_v3_setting[]
    ) as settings,
    COALESCE(
        ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description)::types.q_get_department_detail_v3_cohort
            ORDER BY cd.name
        ) FILTER (WHERE uda.has_access = true AND cd.cohort_id IS NOT NULL),
        '{}'::types.q_get_department_detail_v3_cohort[]
    ) as cohorts,
    COALESCE(
        ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_department_detail_v3_department
            ORDER BY dd.name
        ) FILTER (WHERE uda.has_access = true AND dd.department_id IS NOT NULL),
        '{}'::types.q_get_department_detail_v3_department[]
    ) as departments,
    COALESCE(
        ARRAY_AGG(
            (dm.model_id, dm.name, dm.description)::types.q_get_department_detail_v3_model
            ORDER BY dm.name
        ) FILTER (WHERE uda.has_access = true AND dm.model_id IS NOT NULL),
        '{}'::types.q_get_department_detail_v3_model[]
    ) as models,
    COALESCE(
        ARRAY_AGG(
            (kd.key_id, kd.name, kd.description, kd.key_masked, kd.active)::types.q_get_department_detail_v3_key
            ORDER BY kd.name
        ) FILTER (WHERE uda.has_access = true AND kd.key_id IS NOT NULL),
        '{}'::types.q_get_department_detail_v3_key[]
    ) as keys,
    COALESCE(
        ARRAY_AGG(
            (mka.model_id, mka.key_id)::types.q_get_department_detail_v3_model_key
            ORDER BY mka.model_id, mka.key_id
        ) FILTER (WHERE uda.has_access = true AND mka.model_id IS NOT NULL AND mka.key_id IS NOT NULL),
        '{}'::types.q_get_department_detail_v3_model_key[]
    ) as model_keys
FROM department_exists_check dec
CROSS JOIN user_profile up
CROSS JOIN user_department_access uda
CROSS JOIN department_usage du
LEFT JOIN departments d ON d.id = (SELECT department_id FROM params) AND uda.has_access = true
LEFT JOIN department_price_spent dps ON dps.department_id = d.id AND uda.has_access = true
LEFT JOIN department_staff_count dsc ON dsc.department_id = d.id AND uda.has_access = true
LEFT JOIN department_current_settings dcs ON uda.has_access = true
LEFT JOIN settings_data sd ON uda.has_access = true
LEFT JOIN cohorts_data cd ON uda.has_access = true
LEFT JOIN departments_data dd ON uda.has_access = true
LEFT JOIN department_models dm ON uda.has_access = true
LEFT JOIN keys_data kd ON uda.has_access = true
LEFT JOIN model_key_associations mka ON uda.has_access = true
GROUP BY dec.department_exists, d.id, d.title, d.description, d.active, up.role, uda.has_access, 
         du.total_usage, dsc.staff_count, dps.total_price_spent, dcs.settings_id, up.actor_name
LIMIT 1
$$;

COMMIT;

