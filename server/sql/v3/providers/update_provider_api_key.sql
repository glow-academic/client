UPDATE providers SET
    api_key = $2,
    updated_at = NOW()
WHERE id = $1

