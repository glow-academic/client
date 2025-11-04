UPDATE cohort_departments 
SET active = false, updated_at = NOW()
WHERE cohort_id = $1 AND active = true

