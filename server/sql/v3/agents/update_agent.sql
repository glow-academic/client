UPDATE agents
SET 
    name = $2,
    description = $3,
    temperature = $4,
    model_id = $5,
    reasoning = COALESCE($6::reasoning_effort, 'none'::reasoning_effort),
    active = $7,
    role = $8,
    updated_at = NOW()
WHERE id = $1::uuid

