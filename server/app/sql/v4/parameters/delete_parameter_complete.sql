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
        SELECT 1 FROM parameters WHERE id = (SELECT parameter_id FROM params)
    )::boolean as parameter_exists
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params) as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
usage_check AS (
    SELECT COUNT(DISTINCT sf.scenario_id) as usage_count
    FROM params x
    JOIN fields f ON f.parameter_id = x.parameter_id AND f.active = true
    JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
),
parameter_info AS (
    SELECT 
        p.name,
        COALESCE(uc.usage_count, 0) as usage_count
    FROM params x
    JOIN parameters p ON p.id = x.parameter_id
    CROSS JOIN usage_check uc
),
delete_parameter AS (
    -- Delete parameter (cascade deletes items and parameter_item_departments)
    DELETE FROM parameters
    WHERE id = (SELECT parameter_id FROM params)
        AND (SELECT usage_count FROM usage_check) = 0
    RETURNING name
)
SELECT 
    (SELECT parameter_exists FROM parameter_exists_check)::boolean as parameter_exists,
    COALESCE(pi.usage_count, 0)::bigint as usage_count,
    pi.name::text as name,
    ap.actor_name::text as actor_name
FROM parameter_exists_check pec
CROSS JOIN actor_profile ap
LEFT JOIN parameter_info pi ON pec.parameter_exists = true
LEFT JOIN delete_parameter dp ON dp.name = pi.name AND pec.parameter_exists = true
$$;