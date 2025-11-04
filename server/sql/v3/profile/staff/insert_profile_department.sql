INSERT INTO profile_departments (profile_id, department_id)
VALUES ($1, $2)
ON CONFLICT (profile_id, department_id) DO NOTHING

