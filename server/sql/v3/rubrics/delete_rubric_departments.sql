UPDATE rubric_departments 
SET active = false, updated_at = NOW()
WHERE rubric_id = $1 AND active = true

