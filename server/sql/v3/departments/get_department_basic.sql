SELECT 
    id::text as department_id,
    title,
    description,
    active
FROM departments
WHERE id = $1

