-- Delete parameter if items not in use, returning parameter name and usage count
-- Parameters: $1=parameterId, $2=profile_id (uuid)
WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
usage_check AS (
    SELECT COUNT(DISTINCT sf.scenario_id) as usage_count
    FROM parameter_fields fp
    JOIN scenario_fields sf ON sf.field_id = fp.field_id
    WHERE fp.parameter_id = $1::uuid AND fp.active = true AND sf.active = true
),
parameter_info AS (
    SELECT 
        p.name,
        COALESCE(uc.usage_count, 0) as usage_count
    FROM parameters p
    CROSS JOIN usage_check uc
    WHERE p.id = $1::uuid
),
delete_parameter AS (
    -- Delete parameter (cascade deletes items and parameter_item_departments)
    DELETE FROM parameters
    WHERE id = $1::uuid
        AND (SELECT usage_count FROM usage_check) = 0
    RETURNING name
)
SELECT 
    pi.name,
    pi.usage_count,
    ap.actor_name
FROM parameter_info pi
LEFT JOIN delete_parameter dp ON dp.name = pi.name
CROSS JOIN actor_profile ap

