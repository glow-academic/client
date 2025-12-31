-- Get department title by ID
-- Parameters: $1=department_id (uuid)
-- Returns: title (text)
SELECT title FROM departments WHERE id = $1::uuid

