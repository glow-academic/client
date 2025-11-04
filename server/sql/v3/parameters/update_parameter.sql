UPDATE parameters SET
    name = $2,
    description = $3,
    numerical = $4,
    active = $5,
    document_parameter = $6,
    practice_parameter = $7,
    updated_at = NOW()
WHERE id = $1

