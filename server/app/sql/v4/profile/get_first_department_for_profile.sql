SELECT department_id
FROM profile_departments
WHERE profile_id = $1::uuid
  AND active = true
LIMIT 1
