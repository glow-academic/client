WITH deactivate_existing AS (
    UPDATE persona_department_prompts
    SET active = false, updated_at = NOW()
    WHERE persona_id = $1::uuid 
    AND department_id = $2::uuid 
    AND active = true
)
INSERT INTO persona_department_prompts (persona_id, department_id, prompt_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3::uuid, true, NOW(), NOW())
ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET
    active = true,
    updated_at = NOW()

