INSERT INTO scenario_personas (scenario_id, persona_id, active)
SELECT $1, persona_id, active
FROM scenario_personas
WHERE scenario_id = $2

