-- Get default department data for new department creation
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
        WHERE proname = 'api_get_department_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_department_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_department_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_department_new_v4_setting AS (
    settings_id uuid,
    created_at timestamptz,
    active boolean,
    department_ids uuid[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_department_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    profile_role text,
    actor_name text,
    settings types.q_get_department_new_v4_setting[],
    title text,
    description text,
    active boolean,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id,
           draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
    LIMIT 1
),
user_profile AS (
    SELECT 
        role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = profile.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = profile.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile ON profile.id = x.profile_id
),
settings_departments_data AS (
    -- Get department_ids for each setting
    SELECT 
        ds.settings_id,
        ARRAY_AGG(ds.department_id ORDER BY ds.created_at) as department_ids
    FROM department_settings ds
    WHERE ds.active = true
    GROUP BY ds.settings_id
),
settings_data AS (
    SELECT DISTINCT
        s.id as settings_id,
        s.created_at,
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) as active,
        COALESCE(sdd.department_ids, ARRAY[]::uuid[]) as department_ids
    FROM setting s
    LEFT JOIN settings_departments_data sdd ON sdd.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true)
)
SELECT 
    up.role::text as profile_role,
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (sd.settings_id, sd.created_at, sd.active, sd.department_ids)::types.q_get_department_new_v4_setting
            ORDER BY sd.created_at DESC
        ),
        '{}'::types.q_get_department_new_v4_setting[]
    ) as settings,
    -- Default values for new department (merged with draft payload if draft_id provided)
    COALESCE(
        (SELECT payload->>'title' FROM draft_payload_data),
        ''::text
    ) as title,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        ''::text
    ) as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        true::boolean
    ) as active,
    COALESCE(
        (SELECT draft_version FROM draft_payload_data),
        0::int
    ) as draft_version
FROM user_profile up
CROSS JOIN settings_data sd
GROUP BY up.role, up.actor_name
$$;