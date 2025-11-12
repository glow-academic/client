-- Insert scenario-persona link
-- Parameters: $1=scenario_id (uuid), $2=persona_id (uuid), $3=active (boolean)
INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3::bool, NOW(), NOW())
ON CONFLICT (scenario_id, persona_id) DO UPDATE SET
    active = $3::bool,
    updated_at = NOW()

