-- Get scenario's parameter item links
-- Parameters: $1=scenario_id (uuid)
-- Returns: parameter_item_id
SELECT parameter_item_id FROM scenario_parameter_items 
WHERE scenario_id = $1::uuid

