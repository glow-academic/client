UPDATE profile_departments
SET active = false, updated_at = NOW()
WHERE department_id = $1 AND profile_id = ANY($2)

