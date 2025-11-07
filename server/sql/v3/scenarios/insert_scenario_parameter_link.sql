-- Insert scenario-parameter_item link
-- Parameters: $1=scenario_id (uuid), $2=parameter_item_id (uuid), $3=active (boolean)
INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
VALUES ($1::uuid, $2::uuid, $3::bool)

