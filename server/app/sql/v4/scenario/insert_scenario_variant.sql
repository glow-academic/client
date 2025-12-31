-- Insert scenario variant (for child scenarios)
-- Parameters: $1=name, $2=generated, $3=active, $4=objectives_enabled, $5=images_enabled,
--            $6=scenario_agent_id, $7=image_agent_id
-- Returns: id, name, generated, active, objectives_enabled, images_enabled, scenario_agent_id, image_agent_id
INSERT INTO scenarios (
    name,
    generated,
    active,
    objectives_enabled,
    images_enabled,
    scenario_agent_id,
    image_agent_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *

