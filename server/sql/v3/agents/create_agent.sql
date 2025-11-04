INSERT INTO agents (name, description, temperature, model_id, reasoning, active, role, created_at, updated_at)
VALUES ($1, $2, $3, $4, COALESCE($5::reasoning_effort, 'none'::reasoning_effort), $6, $7, NOW(), NOW())
RETURNING id::text as agent_id

