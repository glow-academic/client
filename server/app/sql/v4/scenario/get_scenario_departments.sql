-- Get all department_ids from scenario_departments junction table
-- Parameters: $1=scenario_id (uuid)
-- Returns: department_id
SELECT department_id
FROM scenario_departments
WHERE scenario_id = $1::uuid AND active = true

