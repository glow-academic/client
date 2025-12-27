-- Delete prompt endpoint
-- Converted to function following agents pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_prompt_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_prompt_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE (if any exist)
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_delete_prompt_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create function
CREATE OR REPLACE FUNCTION api_delete_prompt_v3(
    agent_id uuid,
    prompt_id uuid,
    profile_id uuid,
    department_id uuid DEFAULT NULL
)
RETURNS TABLE (
    prompt_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        agent_id AS agent_id,
        prompt_id AS prompt_id,
        department_id AS department_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
prompt_name_lookup AS (
    SELECT name as prompt_name 
    FROM params x
    JOIN prompts p ON p.id = x.prompt_id
),
prompt_info AS (
    -- Check if this prompt is active (default or department-specific)
    SELECT 
        CASE WHEN EXISTS (
            SELECT 1 FROM agent_prompts 
            WHERE agent_id = (SELECT agent_id FROM params) 
            AND prompt_id = (SELECT prompt_id FROM params) 
            AND active = true
        ) THEN 'default' ELSE 'none' END as default_status,
        CASE WHEN (SELECT department_id FROM params) IS NOT NULL AND EXISTS (
            SELECT 1 FROM agent_department_prompts 
            WHERE agent_id = (SELECT agent_id FROM params) 
            AND prompt_id = (SELECT prompt_id FROM params) 
            AND department_id = (SELECT department_id FROM params) 
            AND active = true
        ) THEN true ELSE false END as is_dept_active
),
latest_default_prompt AS (
    -- Get the latest default prompt (by updated_at) for fallback
    SELECT prompt_id::text
    FROM agent_prompts ap
    JOIN prompts pr ON pr.id = ap.prompt_id
    WHERE ap.agent_id = (SELECT agent_id FROM params)
    AND ap.prompt_id != (SELECT prompt_id FROM params)
    ORDER BY pr.updated_at DESC
    LIMIT 1
),
deactivate_and_fallback AS (
    -- Handle active prompt deactivation and fallback
    UPDATE agent_prompts
    SET active = false, updated_at = NOW()
    WHERE agent_id = (SELECT agent_id FROM params)
    AND prompt_id = (SELECT prompt_id FROM params)
    AND active = true
    AND (SELECT default_status FROM prompt_info) = 'default'
    RETURNING 1
),
activate_latest_default AS (
    -- Activate latest default prompt if we deleted an active default prompt
    UPDATE agent_prompts
    SET active = true, updated_at = NOW()
    WHERE agent_id = (SELECT agent_id FROM params)
    AND prompt_id = (SELECT prompt_id::uuid FROM latest_default_prompt)
    AND EXISTS (SELECT 1 FROM deactivate_and_fallback)
),
deactivate_dept_prompt AS (
    -- Deactivate department-specific prompt link
    UPDATE agent_department_prompts
    SET active = false, updated_at = NOW()
    WHERE agent_id = (SELECT agent_id FROM params)
    AND prompt_id = (SELECT prompt_id FROM params)
    AND ((SELECT department_id FROM params) IS NULL OR department_id = (SELECT department_id FROM params))
    AND active = true
    RETURNING prompt_id
),
delete_agent_prompt_links AS (
    -- Delete default prompt link (if not already deactivated)
    DELETE FROM agent_prompts
    WHERE agent_id = (SELECT agent_id FROM params)
    AND prompt_id = (SELECT prompt_id FROM params)
    AND NOT EXISTS (SELECT 1 FROM deactivate_and_fallback)
),
delete_dept_prompt_links AS (
    -- Delete department-specific prompt links
    -- Delete if already inactive OR if we just deactivated them
    DELETE FROM agent_department_prompts
    WHERE agent_id = (SELECT agent_id FROM params)
    AND prompt_id = (SELECT prompt_id FROM params)
    AND ((SELECT department_id FROM params) IS NULL OR department_id = (SELECT department_id FROM params))
    AND (
        active = false 
        OR EXISTS (SELECT 1 FROM deactivate_dept_prompt)
    )
),
check_other_links AS (
    -- Check if prompt is linked elsewhere (other agents or persona tables)
    SELECT 
        CASE WHEN EXISTS (
            SELECT 1 FROM agent_prompts WHERE prompt_id = (SELECT prompt_id FROM params)
            UNION ALL
            SELECT 1 FROM agent_department_prompts WHERE prompt_id = (SELECT prompt_id FROM params) AND active = true
        ) THEN false ELSE true END as can_delete_prompt
),
deleted_prompt AS (
    -- Delete prompt record if no other links exist
    DELETE FROM prompts
    WHERE id = (SELECT prompt_id FROM params)
    AND (SELECT can_delete_prompt FROM check_other_links) = true
    RETURNING id
)
SELECT 
    COALESCE((SELECT prompt_name FROM prompt_name_lookup), 'Unknown') as prompt_name,
    COALESCE((SELECT actor_name FROM actor_profile), '') as actor_name
FROM params
$$;

COMMIT;

