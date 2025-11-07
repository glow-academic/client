-- Insert scenario-persona link
-- Parameters: $1=scenario_id (uuid), $2=persona_id (uuid), $3=active (boolean)
INSERT INTO scenario_personas (scenario_id, persona_id, active)
VALUES ($1::uuid, $2::uuid, $3::bool)

