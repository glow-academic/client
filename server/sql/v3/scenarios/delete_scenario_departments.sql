UPDATE scenario_departments 
SET active = false, updated_at = NOW()
WHERE scenario_id = $1 AND active = true

