-- Insert scenario-parameter_item link
-- Parameters: $1=scenario_id (uuid), $2=parameter_item_id (uuid), $3=active (boolean)
INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3::bool, NOW(), NOW())
ON CONFLICT (scenario_id, parameter_item_id) DO UPDATE SET
    active = $3::bool,
    updated_at = NOW()

