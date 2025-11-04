INSERT INTO departments (title, description, active, created_at, updated_at)
VALUES ($1, $2, $3, NOW(), NOW())
RETURNING id::text as department_id

