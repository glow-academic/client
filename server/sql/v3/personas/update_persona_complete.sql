-- Update persona with agents and department links in a single transaction
-- Parameters: $1=personaId, $2=name, $3=description, $4=active, $5=color, $6=icon, $7=instructions, $8=text_agent_id (nullable), $9=voice_agent_id (nullable), $10=department_ids (nullable text array), $11=profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $11::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $11::text IS NULL OR $11::text = '' THEN NULL::uuid
            ELSE $11::uuid
        END as resolved_profile_id
),
update_persona AS (
    UPDATE personas
    SET 
        name = $2,
        description = COALESCE($3, ''),
        active = $4,
        color = $5,
        icon = $6,
        instructions = COALESCE($7, ''),
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as persona_id
),
deactivate_all_agents AS (
    -- Deactivate all existing agent links for this persona
    UPDATE persona_agents
    SET active = false, updated_at = NOW()
    WHERE persona_id = $1::uuid AND active = true
),
link_text_agent AS (
    -- Link text agent if provided (must have role simulation-text)
    INSERT INTO persona_agents (persona_id, agent_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $8::uuid,
        true,
        NOW(),
        NOW()
    WHERE $8::uuid IS NOT NULL
    AND EXISTS (SELECT 1 FROM agents a WHERE a.id = $8::uuid AND a.role = 'simulation-text' AND a.active = true)
    ON CONFLICT (persona_id, agent_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_voice_agent AS (
    -- Link voice agent if provided (must have role simulation-voice)
    INSERT INTO persona_agents (persona_id, agent_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $9::uuid,
        true,
        NOW(),
        NOW()
    WHERE $9::uuid IS NOT NULL
    AND EXISTS (SELECT 1 FROM agents a WHERE a.id = $9::uuid AND a.role = 'simulation-voice' AND a.active = true)
    ON CONFLICT (persona_id, agent_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM persona_departments WHERE persona_id = $1::uuid
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($10::text[]) as dept_id
    WHERE COALESCE(array_length($10::text[], 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT persona_id FROM update_persona
