WITH deactivate_all AS (
    UPDATE persona_prompts
    SET active = false, updated_at = NOW()
    WHERE persona_id = $1::uuid AND active = true
    RETURNING 1
),
ensure_execution AS (
    SELECT 1 FROM deactivate_all
    UNION ALL
    SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM persona_prompts WHERE persona_id = $1::uuid AND active = true)
)
INSERT INTO persona_prompts (persona_id, prompt_id, active, created_at, updated_at)
SELECT $1::uuid, $2::uuid, true, NOW(), NOW()
FROM ensure_execution
ON CONFLICT (persona_id, prompt_id) DO UPDATE SET
    active = true,
    updated_at = NOW()

