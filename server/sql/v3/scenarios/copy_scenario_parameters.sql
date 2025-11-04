INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
SELECT $1, parameter_item_id, active
FROM scenario_parameter_items
WHERE scenario_id = $2

