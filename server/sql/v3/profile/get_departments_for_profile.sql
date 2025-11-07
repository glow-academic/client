-- Get departments for a profile
-- Parameters: $1=profile_id (uuid)
-- Returns: id
SELECT DISTINCT d.id
FROM departments d
JOIN profile_departments pd ON pd.department_id = d.id
WHERE pd.profile_id = $1::uuid AND d.active = true

