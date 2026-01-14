-- Create agent with prompt and department links in a single transaction
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_agent_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_agent_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_create_agent_v4(
    name text,
    description text,
    model_id uuid,
    active boolean,
    artifact_name text,  -- Artifact name instead of role (e.g., 'scenario', 'message', 'grade')
    profile_id uuid,
    prompt_id uuid DEFAULT NULL,
    system_prompt text DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    temperature_level_id uuid DEFAULT NULL,
    reasoning_level_id uuid DEFAULT NULL,
    voice_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    agent_id text,
    actor_name text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT
        name AS name,
        description AS description,
        model_id AS model_id,
        active AS active,
        artifact_name AS artifact_name,
        prompt_id AS prompt_id,
        NULLIF(system_prompt, '') AS system_prompt,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        temperature_level_id AS temperature_level_id,
        reasoning_level_id AS reasoning_level_id,
        COALESCE(voice_ids, ARRAY[]::uuid[]) AS voice_ids,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM profile_artifact p
    JOIN params x ON p.id = x.profile_id
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role::text,
        (SELECT department_ids::text[] FROM params)
    ) AS ok
    FROM user_profile up
),
assert_permissions AS (
    -- Ensure permissions are valid before proceeding
    SELECT 1
    FROM validate_create_permissions
    WHERE ok = true
),
actor_profile AS (
    SELECT 
        x.profile_id AS resolved_profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
-- Insert name INTO names_resource table and get ID
name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table and get ID
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_agent AS (
    -- Create agent (without model_id/active columns)
    INSERT INTO agent_artifact (created_at, updated_at)
    SELECT 
        NOW(), 
        NOW()
    FROM assert_permissions ap
    RETURNING id::text as agent_id
),
-- Link agent to model
link_agent_model AS (
    INSERT INTO agent_models (agent_id, model_id, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        x.model_id,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    WHERE x.model_id IS NOT NULL
    ON CONFLICT (agent_id, model_id) DO UPDATE SET updated_at = NOW()
),
-- Link agent active flag
link_agent_active_flag AS (
    INSERT INTO agent_flags (agent_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        f.id,
        'active'::type_agent_flags,
        x.active,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (agent_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Link agent to name
link_agent_name AS (
    INSERT INTO agent_names (agent_id, name_id, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN name_resource nr
    ON CONFLICT (agent_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link agent to description
link_agent_description AS (
    INSERT INTO agent_descriptions (agent_id, description_id, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN description_resource dr
    ON CONFLICT (agent_id, description_id) DO UPDATE SET updated_at = NOW()
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts_resource (system_prompt, created_at, updated_at)
    SELECT x.system_prompt, NOW(), NOW()
    FROM params x
    WHERE x.prompt_id IS NULL AND x.system_prompt IS NOT NULL
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        x.prompt_id::text,
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    FROM params x
    WHERE x.prompt_id IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
),
link_prompt AS (
    -- Link agent to prompt if prompt_id exists
    INSERT INTO agent_prompts (agent_id, prompt_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        sp.prompt_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN selected_prompt_id sp
    ON CONFLICT (agent_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO agent_departments (agent_id, department_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        dept_id,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.department_ids) AS dept_id
    ON CONFLICT (agent_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_temperature_level AS (
    -- Link temperature level if provided
    INSERT INTO agent_temperature_levels (agent_id, temperature_level_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        x.temperature_level_id,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    WHERE x.temperature_level_id IS NOT NULL
    ON CONFLICT (agent_id, temperature_level_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_reasoning_level AS (
    -- Link reasoning level if provided
    INSERT INTO agent_reasoning_levels (agent_id, reasoning_level_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        x.reasoning_level_id,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    WHERE x.reasoning_level_id IS NOT NULL
    ON CONFLICT (agent_id, reasoning_level_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_voices AS (
    -- Link voices if provided (array is never NULL, but may be empty)
    INSERT INTO agent_voices (agent_id, voice_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        voice_id,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.voice_ids) AS voice_id
    ON CONFLICT (agent_id, voice_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    na.agent_id,
    ap.actor_name
FROM new_agent na
CROSS JOIN actor_profile ap
$$;