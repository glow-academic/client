INSERT INTO prompts (system_prompt, created_at, updated_at)
VALUES ($1, NOW(), NOW())
RETURNING id::text as prompt_id

