-- Remove profiles from department - fetches department title and removes profiles in single query
-- Parameters: $1 = department_id (uuid), $2 = profile_ids (uuid[])
-- Returns: department_title (text), removed_count (int)

WITH department_info AS (
    SELECT title FROM departments WHERE id = $1
),
remove_result AS (
    UPDATE profile_departments
    SET active = false, updated_at = NOW()
    WHERE department_id = $1 AND profile_id = ANY($2)
    RETURNING profile_id
)
SELECT 
    (SELECT title FROM department_info) as department_title,
    (SELECT COUNT(*) FROM remove_result)::int as removed_count

