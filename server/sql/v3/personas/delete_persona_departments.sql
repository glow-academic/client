UPDATE persona_departments 
SET active = false, updated_at = NOW()
WHERE persona_id = $1 AND active = true

