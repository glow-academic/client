-- Get scenario's active field links
-- Parameters: $1=scenario_id (uuid)
-- Returns: parameter_item_id (field_id)
SELECT field_id as parameter_item_id FROM scenario_fields 
WHERE scenario_id = $1::uuid AND active = true

