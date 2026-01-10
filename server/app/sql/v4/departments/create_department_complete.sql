-- Create department with settings relationship in single query
-- Converted to function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_department_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_create_department_v4(
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
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
-- Insert name into names table and get ID
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT title, NOW(), NOW()
    FROM params
    WHERE title IS NOT NULL AND title != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description into descriptions table and get ID
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_department AS (
    -- Create department (without title/description columns)
    INSERT INTO department (
        created_at,
        updated_at
    )
    SELECT NOW(), NOW()
    FROM params
    RETURNING id
),
-- Link department to name
link_department_name AS (
    INSERT INTO department_names (department_id, name_id, created_at, updated_at)
    SELECT 
        nd.id,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_department nd
    CROSS JOIN name_resource nr
    ON CONFLICT (department_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link department to description
link_department_description AS (
    INSERT INTO department_descriptions (department_id, description_id, created_at, updated_at)
    SELECT 
        nd.id,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_department nd
    CROSS JOIN description_resource dr
    ON CONFLICT (department_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link department active flag
link_department_active_flag AS (
    INSERT INTO department_flags (department_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        nd.id,
        f.id,
        'active'::type_department_flags,
        (SELECT active FROM params),
        NOW(),
        NOW()
    FROM new_department nd
    CROSS JOIN params p
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (department_id, flag_id, type) DO UPDATE SET 
        value = (SELECT active FROM params),
        updated_at = NOW()
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