-- Delete parameter if items not in use, returning parameter name and usage count
-- Parameters: $1=parameterId, $2=profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
usage_check AS (
    SELECT COUNT(DISTINCT spi.scenario_id) as usage_count
    FROM parameter_items pi
    JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
    WHERE pi.parameter_id = $1::uuid AND spi.active = true
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
    pi.usage_count
FROM parameter_info pi
LEFT JOIN delete_parameter dp ON dp.name = pi.name

