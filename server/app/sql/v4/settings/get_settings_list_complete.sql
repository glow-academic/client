-- Get settings list with department_ids
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

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

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_settings_list_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    settings types.q_get_settings_list_v4_setting[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
settings_departments_data AS (
    SELECT 
        ds.settings_id,
        ARRAY_AGG(ds.department_id::text ORDER BY ds.created_at) as department_ids
    FROM department_settings ds
    WHERE ds.active = true
    GROUP BY ds.settings_id
)
SELECT 
    ap.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (s.id, s.created_at, s.active, s.name, s.description,
             COALESCE(sdd.department_ids, ARRAY[]::text[])
            )::types.q_get_settings_list_v4_setting
            ORDER BY s.created_at DESC
        ),
        '{}'::types.q_get_settings_list_v4_setting[]
    ) as settings
FROM settings s
CROSS JOIN actor_profile ap
LEFT JOIN settings_departments_data sdd ON sdd.settings_id = s.id
WHERE s.active = true  -- Only return active settings
GROUP BY ap.actor_name
$$;

COMMIT;

