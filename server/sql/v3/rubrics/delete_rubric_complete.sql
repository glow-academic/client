-- Delete rubric with existence and usage checks in a single transaction
-- Parameters: $1=rubricId
-- Returns: rubric_id, name, usage_count (or no rows if rubric doesn't exist)
-- If usage_count > 0, rubric is not deleted (caller should raise 400 error)
-- If no rows returned, rubric doesn't exist (caller should raise 404 error)
WITH rubric_info AS (
    -- Check if rubric exists and get usage count
    SELECT 
        r.id,
        r.name,
        (SELECT COUNT(*) FROM simulations WHERE rubric_id = r.id) as usage_count
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
    CASE WHEN dr.rubric_id IS NOT NULL THEN true ELSE false END as deleted
FROM rubric_info ri
LEFT JOIN delete_rubric dr ON dr.rubric_id = ri.id::text

