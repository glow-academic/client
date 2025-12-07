-- Duplicate agent with profile_id for auditing
-- Parameters: $1 = agent_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
source_agent AS (
    SELECT 
        a.id as source_id,
        a.name,
        a.description,
        a.model_id,
        a.role,
        ap.prompt_id,
        COALESCE(pr.system_prompt, '') as system_prompt,
        -- Get temperature and reasoning from junction tables
        atl.model_temperature_level_id,
        arl.model_reasoning_level_id
    FROM agents a
    LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts pr ON pr.id = ap.prompt_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    WHERE a.id = $1::uuid
),
new_prompt AS (
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT system_prompt, NOW(), NOW()
    FROM source_agent
    RETURNING id as prompt_id
),
new_agent AS (
    INSERT INTO agents (name, description, model_id, active, role, created_at, updated_at)
    SELECT 
        sa.name || ' Copy',
        sa.description,
        sa.model_id,
        false,
        sa.role,
        NOW(),
        NOW()
    FROM source_agent sa
    RETURNING id::text as agent_id
),
copy_temperature AS (
    INSERT INTO agent_temperature_levels (agent_id, model_temperature_level_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        sa.model_temperature_level_id,
        true,
        NOW(),
        NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    WHERE sa.model_temperature_level_id IS NOT NULL
),
copy_reasoning AS (
    INSERT INTO agent_reasoning_levels (agent_id, model_reasoning_level_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        sa.model_reasoning_level_id,
        true,
        NOW(),
        NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    WHERE sa.model_reasoning_level_id IS NOT NULL
),
link_prompt AS (
    INSERT INTO agent_prompts (agent_id, prompt_id, active, created_at, updated_at)
    SELECT na.agent_id::uuid, np.prompt_id, true, NOW(), NOW()
    FROM new_agent na
    CROSS JOIN new_prompt np
),
copy_departments AS (
    INSERT INTO agent_departments (agent_id, department_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        ad.department_id,
        ad.active,
        NOW(),
        NOW()
    FROM source_agent sa
    JOIN agent_departments ad ON ad.agent_id = sa.source_id AND ad.active = true
    CROSS JOIN new_agent na
)
SELECT agent_id FROM new_agent

