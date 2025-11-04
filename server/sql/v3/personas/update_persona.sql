UPDATE personas SET
    name = $2,
    description = $3,
    active = $4,
    color = $5,
    icon = $6,
    model_id = $7,
    reasoning = COALESCE($8::reasoning_effort, 'none'::reasoning_effort),
    temperature = $9,
    updated_at = NOW()
WHERE id = $1

