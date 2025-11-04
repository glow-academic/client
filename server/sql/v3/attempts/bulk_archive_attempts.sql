UPDATE simulation_attempts
SET archived = $1,
    updated_at = NOW()
WHERE id = ANY($2::uuid[])

