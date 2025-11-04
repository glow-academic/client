UPDATE simulation_departments 
SET active = false, updated_at = NOW()
WHERE simulation_id = $1 AND active = true

