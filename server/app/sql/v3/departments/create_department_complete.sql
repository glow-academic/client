-- Create department with settings relationship in single query
-- Converted to function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_department_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_department_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_create_department_v3(
    title text,
    description text,
    active boolean,
    settings_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    department_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        title AS title,
        description AS description,
        active AS active,
        settings_id AS settings_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
new_department AS (
    -- Create department
    INSERT INTO departments (
        title,
        description,
        active,
        created_at,
        updated_at
    )
    SELECT title, description, active, NOW(), NOW()
    FROM params
    RETURNING id
),
link_settings AS (
    -- Link settings if provided
    INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
    SELECT 
        settings_id,
        nd.id,
        true,
        NOW(),
        NOW()
    FROM new_department nd
    CROSS JOIN params p
    WHERE p.settings_id IS NOT NULL
    ON CONFLICT (settings_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
-- Return department ID and actor name
SELECT 
    nd.id as department_id,
    ap.actor_name::text as actor_name
FROM new_department nd
CROSS JOIN actor_profile ap
$$;

COMMIT;
