-- Deactivate cohort profile link (preserves history)
UPDATE cohort_profiles
SET active = false, updated_at = NOW()
WHERE cohort_id = $1 AND profile_id = $2

