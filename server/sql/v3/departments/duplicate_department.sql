INSERT INTO departments (title, description, active, created_at, updated_at)
SELECT $2, description, false, NOW(), NOW()
FROM departments
WHERE id = $1
RETURNING id::text as department_id

