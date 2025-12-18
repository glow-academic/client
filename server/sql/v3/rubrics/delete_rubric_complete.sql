-- Delete rubric with existence and usage checks in a single transaction
-- Parameters: $1=rubricId, $2=profile_id (uuid)
-- Returns: rubric_id, name, usage_count, actor_name (or no rows if rubric doesn't exist)
-- If usage_count > 0, rubric is not deleted (caller should raise 400 error)
-- If no rows returned, rubric doesn't exist (caller should raise 404 error)
WITH actor_profile AS (
    SELECT
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
rubric_info AS (
    -- Check if rubric exists and get usage count
    SELECT 
        r.id,
        r.name,
        (SELECT COUNT(DISTINCT ss.simulation_id) FROM simulation_scenarios ss WHERE ss.rubric_id = r.id AND ss.active = true) as usage_count
    FROM rubrics r
    WHERE r.id = $1::uuid
),
delete_rubric AS (
    -- Delete rubric only if it exists and is not in use (cascade deletes standard_groups and standards)
    DELETE FROM rubrics
    WHERE id IN (
        SELECT id FROM rubric_info WHERE usage_count = 0
    )
    RETURNING id::text as rubric_id
)
-- Return rubric info and usage count (even if not deleted, so caller can determine error)
SELECT 
    ri.id::text as rubric_id,
    ri.name,
    ri.usage_count,
    CASE WHEN dr.rubric_id IS NOT NULL THEN true ELSE false END as deleted,
    ap.actor_name
FROM rubric_info ri
LEFT JOIN delete_rubric dr ON dr.rubric_id = ri.id::text
CROSS JOIN actor_profile ap

