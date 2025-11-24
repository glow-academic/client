-- Insert scenario variant (for child scenarios)
-- Parameters: $1=name, $2=generated, $3=active, $4=hints_enabled, $5=objectives_enabled,
--            $6=image_input_enabled, $7=input_guardrail_enabled, $8=output_guardrail_enabled
-- Returns: id, name, generated, active, hints_enabled, objectives_enabled, image_input_enabled, input_guardrail_enabled, output_guardrail_enabled
INSERT INTO scenarios (
    name,
    generated,
    active,
    hints_enabled,
    objectives_enabled,
    image_input_enabled,
    input_guardrail_enabled,
    output_guardrail_enabled
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *

