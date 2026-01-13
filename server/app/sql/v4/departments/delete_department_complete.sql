-- Delete department with existence and usage checks in a single transaction
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
        WHERE proname = 'api_delete_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_department_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_department_v4(
    department_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    department_exists boolean,
    deleted boolean,
    total_usage bigint,
    title text,
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
department_exists_check AS (
    -- Check if department exists independently of deletion
    SELECT EXISTS(
        SELECT 1 FROM department_artifact WHERE id = (SELECT department_id FROM params)
    )::boolean as department_exists
),
actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
department_info AS (
    -- Check if department exists and get usage counts
    SELECT 
        d.id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1),
        (SELECT COUNT(*) FROM simulation_departments WHERE department_id = d.id AND active = true) as simulation_count,
        (SELECT COUNT(*) FROM scenario_departments WHERE department_id = d.id AND active = true) as scenario_count,
        (SELECT COUNT(*) FROM persona_departments WHERE department_id = d.id AND active = true) as persona_count,
        (SELECT COUNT(*) FROM document_departments WHERE department_id = d.id AND active = true) as document_count,
        (SELECT COUNT(*) FROM cohort_departments WHERE department_id = d.id AND active = true) as cohort_count
    FROM department_artifact d
    WHERE d.id = (SELECT department_id FROM params)
),
usage_summary AS (
    -- Calculate total usage
    SELECT 
        id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = di.id LIMIT 1) as title,
        simulation_count,
        scenario_count,
        persona_count,
        document_count,
        cohort_count,
        (simulation_count + scenario_count + persona_count + document_count + cohort_count) as total_usage
    FROM department_info di
),
delete_department AS (
    -- Delete department only if it exists and is not in use
    DELETE FROM department_artifact
    WHERE id IN (
        SELECT id FROM usage_summary WHERE total_usage = 0
    )
    RETURNING id
)
-- Return department info and usage counts (even if not deleted, so caller can determine error)
SELECT 
    dec.department_exists::boolean as department_exists,
    CASE WHEN dd.id IS NOT NULL THEN true ELSE false END::boolean as deleted,
    COALESCE(us.total_usage, 0)::bigint as total_usage,
    COALESCE(us.title, '')::text as title,
    ap.actor_name::text as actor_name
FROM department_exists_check dec
CROSS JOIN actor_profile ap
LEFT JOIN usage_summary us ON dec.department_exists = true
LEFT JOIN delete_department dd ON dd.id = us.id AND us.total_usage = 0
$$;