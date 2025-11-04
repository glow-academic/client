UPDATE scenarios SET
    name = $1,
    active = $2,
    hints_enabled = $3,
    objectives_enabled = $4,
    image_input_enabled = $5,
    copy_paste_allowed = $6,
    input_guardrail_enabled = $7,
    output_guardrail_enabled = $8,
    updated_at = NOW()
WHERE id = $9

