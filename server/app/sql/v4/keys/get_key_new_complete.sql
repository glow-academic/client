-- Get default key structure for new key creation
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_key_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_key_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_key_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_key_new_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_key_new_v4_model AS (
    model_id uuid,
    name text,
    description text,
    provider text,
    active boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_key_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    key_id text,
    name text,
    key_masked text,
    description text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz,
    department_ids text[],
    model_ids text[],
    valid_department_ids text[],
    can_edit boolean,
    departments types.q_get_key_new_v4_department[],
    models types.q_get_key_new_v4_model[],
    actor_name text,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id, draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    AND d.resource_type = 'keys'::draft_resource_type
    LIMIT 1
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
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
profile_data AS (
    SELECT role as user_role 
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
primary_department_id AS (
    SELECT department_id::text
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    WHERE pd.is_primary = TRUE AND pd.active = true
    LIMIT 1
)
SELECT 
    ''::text as key_id,
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        ''::text
    ) as name,
    '****'::text as key_masked,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        ''::text
    ) as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        true::boolean
    ) as active,
    NOW()::timestamptz as created_at,
    NOW()::timestamptz as updated_at,
    -- Set default department_ids based on role
    -- Superadmin: NULL (empty = all departments = default object)
    -- Non-superadmin: [primaryDepartmentId] if available
    CASE 
        WHEN pr.user_role = 'superadmin' THEN NULL::text[]
        WHEN pd.department_id IS NOT NULL THEN ARRAY[pd.department_id]
        ELSE ARRAY[]::text[]
    END as department_ids,
    ARRAY[]::text[] as model_ids,
    COALESCE(vd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    -- Default keys (empty department_ids) are read-only for non-superadmin
    CASE 
        WHEN pr.user_role = 'superadmin' THEN true
        WHEN pr.user_role = 'admin' AND pd.department_id IS NOT NULL THEN true
        ELSE false
    END::boolean as can_edit,
    COALESCE(
        ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_key_new_v4_department
            ORDER BY dd.name
        ) FILTER (WHERE dd.department_id IS NOT NULL),
        '{}'::types.q_get_key_new_v4_department[]
    ) as departments,
    '{}'::types.q_get_key_new_v4_model[] as models,
    ap.actor_name::text as actor_name,
    COALESCE(
        (SELECT draft_version FROM draft_payload_data),
        0
    )::int as draft_version
FROM valid_depts vd
CROSS JOIN profile_data pr
LEFT JOIN primary_department_id pd ON true
CROSS JOIN departments_data dd
CROSS JOIN actor_profile ap
GROUP BY pr.user_role, pd.department_id, vd.dept_ids, ap.actor_name
$$;