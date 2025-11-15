-- Duplicate department - fetches original and creates copy in single query
-- Parameters: $1 = department_id (uuid)
-- Returns: new_department_id (text), original_title (text)

WITH original_dept AS (
    SELECT 
        id,
        title,
        description,
        active
    FROM departments
    WHERE id = $1
),
new_dept AS (
    INSERT INTO departments (title, description, active, created_at, updated_at)
    SELECT 
        title || ' Copy',
        description,
        false,
        NOW(),
        NOW()
    FROM original_dept
    RETURNING id::text as department_id
)
SELECT 
    (SELECT department_id FROM new_dept) as new_department_id,
    (SELECT title FROM original_dept) as original_title

