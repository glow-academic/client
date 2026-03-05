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
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_dept AS (
    SELECT 
        d.id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.department_id = d.id LIMIT 1) as title,
        COALESCE((SELECT d.description FROM department_descriptions_junction dd JOIN descriptions_resource d ON dd.descriptions_id = d.id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND f.value = true) as active
    FROM department_artifact d
    WHERE d.id = (SELECT department_id FROM params)
),
get_or_create_name AS (
    -- Get or create name in names table
    INSERT INTO names_resource (name, created_at)
    SELECT od.title || ' Copy', NOW()
    FROM original_dept od
    WHERE od.title IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as names_id, name as name_value
),
get_or_create_description AS (
    -- Get or create description in descriptions table
    INSERT INTO descriptions_resource (description, created_at)
    SELECT od.description, NOW()
    FROM original_dept od
    WHERE od.description IS NOT NULL AND od.description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as descriptions_id
),
get_active_flag AS (
    -- Get the active flag ID
    SELECT id as flag_id
    FROM flags_resource
    WHERE name = 'active'
    LIMIT 1
),
new_dept AS (
    INSERT INTO department_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM original_dept
    RETURNING id
),
link_name AS (
    -- Link name to new department
    INSERT INTO department_names_junction (department_id, names_id, created_at)
    SELECT nd.id, gocn.names_id, NOW()
    FROM new_dept nd
    CROSS JOIN get_or_create_name gocn
    WHERE gocn.names_id IS NOT NULL
),
link_description AS (
    -- Link description to new department (if provided)
    INSERT INTO department_descriptions_junction (department_id, descriptions_id, created_at)
    SELECT nd.id, gocd.descriptions_id, NOW()
    FROM new_dept nd
    CROSS JOIN get_or_create_description gocd
    WHERE gocd.descriptions_id IS NOT NULL
),
link_active_flag AS (
    -- Link active flag to new department (set to false for duplicate)
    INSERT INTO department_flags_junction (department_id, flag_id, created_at) SELECT nd.id, gaf.flag_id, NOW()
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