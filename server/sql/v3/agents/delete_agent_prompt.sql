WITH prompt_info AS (
    -- Check if this prompt is active (default or department-specific)
    SELECT 
        CASE WHEN EXISTS (
            SELECT 1 FROM agent_prompts 
            WHERE agent_id = $1::uuid AND prompt_id = $2::uuid AND active = true
        ) THEN 'default' ELSE 'none' END as default_status,
        CASE WHEN $3::uuid IS NOT NULL AND EXISTS (
            SELECT 1 FROM agent_department_prompts 
            WHERE agent_id = $1::uuid AND prompt_id = $2::uuid 
            AND department_id = $3::uuid AND active = true
        ) THEN true ELSE false END as is_dept_active
),
latest_default_prompt AS (
    -- Get the latest default prompt (by updated_at) for fallback
    SELECT prompt_id::text
    FROM agent_prompts ap
    JOIN prompts pr ON pr.id = ap.prompt_id
    WHERE ap.agent_id = $1::uuid 
    AND ap.prompt_id != $2::uuid
    ORDER BY pr.updated_at DESC
    LIMIT 1
),
deactivate_and_fallback AS (
    -- Handle active prompt deactivation and fallback
    UPDATE agent_prompts
    SET active = false, updated_at = NOW()
    WHERE agent_id = $1::uuid 
    AND prompt_id = $2::uuid 
    AND active = true
    AND (SELECT default_status FROM prompt_info) = 'default'
    RETURNING 1
),
activate_latest_default AS (
    -- Activate latest default prompt if we deleted an active default prompt
    UPDATE agent_prompts
    SET active = true, updated_at = NOW()
    WHERE agent_id = $1::uuid
    AND prompt_id = (SELECT prompt_id::uuid FROM latest_default_prompt)
    AND EXISTS (SELECT 1 FROM deactivate_and_fallback)
),
deactivate_dept_prompt AS (
    -- Deactivate department-specific prompt link
    UPDATE agent_department_prompts
    SET active = false, updated_at = NOW()
    WHERE agent_id = $1::uuid 
    AND prompt_id = $2::uuid 
    AND ($3::uuid IS NULL OR department_id = $3::uuid)
    AND active = true
    RETURNING prompt_id
),
delete_agent_prompt_links AS (
    -- Delete default prompt link (if not already deactivated)
    DELETE FROM agent_prompts
    WHERE agent_id = $1::uuid 
    AND prompt_id = $2::uuid
    AND NOT EXISTS (SELECT 1 FROM deactivate_and_fallback)
),
delete_dept_prompt_links AS (
    -- Delete department-specific prompt links
    -- Delete if already inactive OR if we just deactivated them
    DELETE FROM agent_department_prompts
    WHERE agent_id = $1::uuid 
    AND prompt_id = $2::uuid
    AND ($3::uuid IS NULL OR department_id = $3::uuid)
    AND (
        active = false 
        OR EXISTS (SELECT 1 FROM deactivate_dept_prompt)
    )
),
check_other_links AS (
    -- Check if prompt is linked elsewhere (other agents or persona tables)
    SELECT 
        CASE WHEN EXISTS (
            SELECT 1 FROM agent_prompts WHERE prompt_id = $2::uuid
            UNION ALL
            SELECT 1 FROM agent_department_prompts WHERE prompt_id = $2::uuid AND active = true
            UNION ALL
            SELECT 1 FROM persona_prompts WHERE prompt_id = $2::uuid
            UNION ALL
            SELECT 1 FROM persona_department_prompts WHERE prompt_id = $2::uuid AND active = true
        ) THEN false ELSE true END as can_delete_prompt
)
-- Delete prompt record if no other links exist
DELETE FROM prompts
WHERE id = $2::uuid
AND (SELECT can_delete_prompt FROM check_other_links) = true

