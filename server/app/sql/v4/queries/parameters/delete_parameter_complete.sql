-- Delete parameter if items not in use, returning parameter name and usage count
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DROP FUNCTION IF EXISTS api_delete_parameter_v4(uuid, uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_parameter_v4(
    parameter_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    parameter_exists boolean,
    usage_count bigint,
    name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        parameter_id AS parameter_id,
        profile_id AS profile_id
),
parameter_exists_check AS (
    -- Check if parameter exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM parameter_artifact WHERE id = (SELECT parameter_id FROM params)
    )::boolean as parameter_exists
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params) as profile_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
usage_check AS (
    SELECT COUNT(DISTINCT spf.scenario_id) as usage_count
    FROM params x
    JOIN parameter_fields_resource pfr ON pfr.parameter_id = x.parameter_id
    JOIN scenario_parameter_fields_junction spf ON spf.parameter_field_id = pfr.id AND spf.active = true
),
parameter_info AS (
    SELECT 
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1) as name,
        COALESCE(uc.usage_count, 0) as usage_count
    FROM params x
    JOIN parameters_resource p ON p.id = x.parameter_id
    CROSS JOIN usage_check uc
),
delete_parameter AS (
    -- Delete parameter (cascade deletes items and parameter_item_departments)
    DELETE FROM parameter_artifact
    WHERE id = (SELECT parameter_id FROM params)
        AND (SELECT usage_count FROM usage_check) = 0
    RETURNING id
)
SELECT 
    (SELECT parameter_exists FROM parameter_exists_check)::boolean as parameter_exists,
    COALESCE(pi.usage_count, 0)::bigint as usage_count,
    pi.name::text as name,
    ap.actor_name::text as actor_name
FROM parameter_exists_check pec
CROSS JOIN actor_profile ap
LEFT JOIN parameter_info pi ON pec.parameter_exists = true
LEFT JOIN delete_parameter dp ON dp.id = (SELECT parameter_id FROM params) AND pec.parameter_exists = true
$$;