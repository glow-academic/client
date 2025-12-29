-- Link a question to a scenario
-- Parameters: $1 = scenario_id (uuid), $2 = question_id (uuid), $3 = active (boolean)
-- Creates or updates scenario_questions junction table entry

INSERT INTO scenario_questions (scenario_id, question_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3::boolean, NOW(), NOW())
ON CONFLICT (scenario_id, question_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW()
RETURNING question_id;

