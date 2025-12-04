-- Get all active departments for login page
-- Parameters: none
-- Returns: id, title, description
SELECT 
    id,
    title,
    description
FROM departments 
WHERE active = true
ORDER BY title;

