-- Update department with settings relationship in single query
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
        WHERE proname = 'api_update_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_department_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_update_department_v4(
    department_id uuid,
    title text,
    description text,
    active boolean,
    settings_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    department_id uuid,
    title text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        department_id AS department_id,
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
-- Insert/update name in names table
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT title, NOW(), NOW()
    FROM params
    WHERE title IS NOT NULL AND title != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert/update description in descriptions table
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
department_update AS (
    -- Update department (without title/description/active columns)
    UPDATE department SET
        updated_at = NOW()
    WHERE id = (SELECT department_id FROM params)
    RETURNING id
),
-- Update department name link
update_department_name AS (
    -- Remove old name links
    DELETE FROM department_names
    WHERE department_id = (SELECT department_id FROM params)
      AND name_id NOT IN (SELECT name_id FROM name_resource)
),
link_department_name AS (
    INSERT INTO department_names (department_id, name_id, created_at, updated_at)
    SELECT 
        du.id,
        nr.name_id,
        NOW(),
        NOW()
    FROM department_update du
    CROSS JOIN name_resource nr
    ON CONFLICT (department_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Update department description link
update_department_description AS (
    -- Remove old description links
    DELETE FROM department_descriptions
    WHERE department_id = (SELECT department_id FROM params)
      AND description_id NOT IN (SELECT description_id FROM description_resource)
),
link_department_description AS (
    INSERT INTO department_descriptions (department_id, description_id, created_at, updated_at)
    SELECT 
        du.id,
        dr.description_id,
        NOW(),
        NOW()
    FROM department_update du
    CROSS JOIN description_resource dr
    ON CONFLICT (department_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Update department active flag
update_department_active_flag AS (
    UPDATE department_flags SET
        value = (SELECT active FROM params),
        updated_at = NOW()
    WHERE department_id = (SELECT department_id FROM params)
      AND type = 'active'::type_department_flags
),
insert_department_active_flag AS (
    INSERT INTO department_flags (department_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        du.id,
        f.id,
        'active'::type_department_flags,
        (SELECT active FROM params),
        NOW(),
        NOW()
    FROM department_update du
    CROSS JOIN params p
    CROSS JOIN flags f
    WHERE f.name = 'active'
      AND NOT EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = du.id AND df.type = 'active'::type_department_flags)
    ON CONFLICT (department_id, flag_id, type) DO UPDATE SET 
        value = (SELECT active FROM params),
        updated_at = NOW()
),
remove_existing_settings AS (
    -- Remove existing settings link if settings_id is null or different
    DELETE FROM department_settings
    WHERE department_id = (SELECT department_id FROM params)
      AND (
          (SELECT settings_id FROM params) IS NULL 
          OR settings_id != (SELECT settings_id FROM params)
      )
),
link_settings AS (
    -- Link settings if provided
    INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
    SELECT 
        settings_id,
        du.id,
        true,
        NOW(),
        NOW()
    FROM department_update du
    CROSS JOIN params p
    WHERE p.settings_id IS NOT NULL
    ON CONFLICT (settings_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
-- Return updated department info
SELECT 
    du.id as department_id,
    (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = du.id LIMIT 1)::text as title,
    ap.actor_name::text as actor_name
FROM department_update du
CROSS JOIN actor_profile ap
LIMIT 1
$$;