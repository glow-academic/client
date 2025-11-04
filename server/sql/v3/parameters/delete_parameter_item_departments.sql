UPDATE parameter_item_departments 
SET active = false, updated_at = NOW()
WHERE parameter_item_id = $1::uuid AND active = true

