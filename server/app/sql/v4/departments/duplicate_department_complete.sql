-- Duplicate department - fetches original and creates copy in single query
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
        WHERE proname = 'api_duplicate_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_department_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_department_v4(
    department_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_department_id uuid,
    original_title text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        department_id AS department_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
original_dept AS (
    SELECT 
        d.id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as title,
        COALESCE((SELECT d.description FROM department_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = TRUE) as active
    FROM departments d
    WHERE d.id = (SELECT department_id FROM params)
),
get_or_create_name AS (
    -- Get or create name in names table
    INSERT INTO names (name, created_at, updated_at)
    SELECT od.title || ' Copy', NOW(), NOW()
    FROM original_dept od
    WHERE od.title IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name as name_value
),
get_or_create_description AS (
    -- Get or create description in descriptions table
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT od.description, NOW(), NOW()
    FROM original_dept od
    WHERE od.description IS NOT NULL AND od.description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
get_active_flag AS (
    -- Get the active flag ID
    SELECT id as flag_id
    FROM flags
    WHERE name = 'active'
    LIMIT 1
),
new_dept AS (
    INSERT INTO departments (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM original_dept
    RETURNING id
),
link_name AS (
    -- Link name to new department
    INSERT INTO department_names (department_id, name_id, created_at, updated_at)
    SELECT nd.id, gocn.name_id, NOW(), NOW()
    FROM new_dept nd
    CROSS JOIN get_or_create_name gocn
    WHERE gocn.name_id IS NOT NULL
),
link_description AS (
    -- Link description to new department (if provided)
    INSERT INTO department_descriptions (department_id, description_id, created_at, updated_at)
    SELECT nd.id, gocd.description_id, NOW(), NOW()
    FROM new_dept nd
    CROSS JOIN get_or_create_description gocd
    WHERE gocd.description_id IS NOT NULL
),
link_active_flag AS (
    -- Link active flag to new department (set to false for duplicate)
    INSERT INTO department_flags (department_id, flag_id, type, value, created_at, updated_at)
    SELECT nd.id, gaf.flag_id, 'active'::type_department_flags, false, NOW(), NOW()
    FROM new_dept nd
    CROSS JOIN get_active_flag gaf
)
SELECT 
    nd.id as new_department_id,
    od.title::text as original_title,
    ap.actor_name::text as actor_name
FROM new_dept nd
CROSS JOIN original_dept od
CROSS JOIN actor_profile ap
$$;