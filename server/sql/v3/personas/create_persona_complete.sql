-- Create persona with agents and department links in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=color, $5=icon, $6=instructions, $7=text_agent_id (nullable), $8=voice_agent_id (nullable), $9=department_ids (nullable text array), $10=profile_id (uuid or "guest-profile-id")
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $10::uuid AND sdg.active = true
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
            WHEN $10::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $10::text IS NULL OR $10::text = '' THEN NULL::uuid
            ELSE $10::uuid
        END as resolved_profile_id
),
new_persona AS (
    INSERT INTO personas (name, description, active, color, icon, instructions, created_at, updated_at)
    VALUES ($1, COALESCE($2, ''), $3, $4, $5, COALESCE($6, ''), NOW(), NOW())
    RETURNING id::text as persona_id
),
link_text_agent AS (
    -- Link text agent if provided (must have role simulation-text)
    INSERT INTO persona_text_agents (persona_id, agent_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        $7::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    WHERE $7::uuid IS NOT NULL
    AND EXISTS (SELECT 1 FROM agents a WHERE a.id = $7::uuid AND a.role = 'simulation-text' AND a.active = true)
    ON CONFLICT (persona_id, agent_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_voice_agent AS (
    -- Link voice agent if provided (must have role simulation-voice)
    INSERT INTO persona_voice_agents (persona_id, agent_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        $8::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    WHERE $8::uuid IS NOT NULL
    AND EXISTS (SELECT 1 FROM agents a WHERE a.id = $8::uuid AND a.role = 'simulation-voice' AND a.active = true)
    ON CONFLICT (persona_id, agent_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN UNNEST($9::text[]) as dept_id
    WHERE COALESCE(array_length($9::text[], 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT persona_id FROM new_persona
