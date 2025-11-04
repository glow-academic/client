UPDATE profiles SET
    role = $2,
    active = $3,
    updated_at = NOW()
WHERE id = $1

