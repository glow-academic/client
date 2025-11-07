-- Delete scenario personas
-- Parameters: $1=scenario_id (uuid)
DELETE FROM scenario_personas WHERE scenario_id = $1::uuid
