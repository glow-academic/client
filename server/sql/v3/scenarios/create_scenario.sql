INSERT INTO scenarios (
    name,
    active,
    hints_enabled,
    objectives_enabled,
    image_input_enabled,
    copy_paste_allowed,
    input_guardrail_enabled,
    output_guardrail_enabled
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id

