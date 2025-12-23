-- Delete department with existence and usage checks in a single transaction
-- Parameters: $1=departmentId, $2=current_profile_id (uuid)
-- Returns: department_id, title, and usage counts (or no rows if department doesn't exist), actor_name
-- If total_usage > 0, department is not deleted (caller should raise 400 error)
-- If no rows returned, department doesn't exist (caller should raise 404 error)
WITH actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
department_info AS (
    -- Check if department exists and get usage counts
    SELECT 
        d.id,
        d.title,
        (SELECT COUNT(*) FROM simulation_departments WHERE department_id = d.id AND active = true) as simulation_count,
        (SELECT COUNT(*) FROM scenario_departments WHERE department_id = d.id AND active = true) as scenario_count,
        (SELECT COUNT(*) FROM persona_departments WHERE department_id = d.id AND active = true) as persona_count,
        (SELECT COUNT(*) FROM document_departments WHERE department_id = d.id AND active = true) as document_count,
        (SELECT COUNT(*) FROM cohort_departments WHERE department_id = d.id AND active = true) as cohort_count
    FROM departments d
    WHERE d.id = $1::uuid
),
usage_summary AS (
    -- Calculate total usage
    SELECT 
        id,
        title,
        simulation_count,
        scenario_count,
        persona_count,
        document_count,
        cohort_count,
        (simulation_count + scenario_count + persona_count + document_count + cohort_count) as total_usage
    FROM department_info
),
delete_department AS (
    -- Delete department only if it exists and is not in use
    DELETE FROM departments
    WHERE id IN (
        SELECT id FROM usage_summary WHERE total_usage = 0
    )
    RETURNING id::text as department_id
)
-- Return department info and usage counts (even if not deleted, so caller can determine error)
SELECT 
    di.id::text as department_id,
    di.title,
    di.simulation_count,
    di.scenario_count,
    di.persona_count,
    di.document_count,
    di.cohort_count,
    di.total_usage,
    CASE WHEN dd.department_id IS NOT NULL THEN true ELSE false END as deleted,
    ap.actor_name
FROM usage_summary di
CROSS JOIN actor_profile ap
LEFT JOIN delete_department dd ON dd.department_id = di.id::text

