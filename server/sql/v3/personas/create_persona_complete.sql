-- Create persona with agents and department links in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=color, $5=icon, $6=instructions, $7=text_agent_id (nullable), $8=voice_agent_id (nullable), $9=department_ids (nullable text array), $10=profile_id (uuid or "guest-profile-id"), $11=parameter_ids (nullable text array), $12=example_ids (nullable text array)
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
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
),
link_parameters AS (
    -- Link parameters if provided (array is never NULL, but may be empty)
    INSERT INTO parameter_personas (parameter_id, persona_id, active, created_at, updated_at)
    SELECT 
        param_id::uuid,
        np.persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN UNNEST($11::text[]) as param_id
    WHERE COALESCE(array_length($11::text[], 1), 0) > 0
    ON CONFLICT (parameter_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
backfill_persona_fields AS (
    -- Backfill persona_fields for linked parameters (use default field)
    -- Only runs if persona_fields table exists
    INSERT INTO persona_fields (persona_id, field_id, active, created_at, updated_at)
    SELECT DISTINCT
        pp.persona_id,
        pf.field_id,
        TRUE,
        NOW(),
        NOW()
    FROM parameter_personas pp
    JOIN parameter_fields pf ON pf.parameter_id = pp.parameter_id AND pf.active = TRUE AND pf.default = TRUE
    CROSS JOIN new_persona np
    WHERE pp.persona_id = np.persona_id::uuid
    AND pp.active = TRUE
    AND NOT EXISTS (
        SELECT 1 FROM persona_fields pf2
        WHERE pf2.persona_id = pp.persona_id
        AND pf2.field_id = pf.field_id
        AND pf2.active = TRUE
    )
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'persona_fields')
    ON CONFLICT (persona_id, field_id) DO UPDATE SET
        active = TRUE,
        updated_at = NOW()
),
examples_with_index AS (
    -- Prepare examples with their index (skip composite IDs - filtered in Python)
    SELECT 
        ex_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST($12::text[]) as ex_text
    WHERE COALESCE(array_length($12::text[], 1), 0) > 0
),
existing_examples AS (
    -- Find existing examples by text
    SELECT id as example_id, example
    FROM examples
    WHERE example = ANY(SELECT ex_text FROM examples_with_index)
),
new_examples AS (
    -- Create new examples that don't exist yet
    INSERT INTO examples (example, created_at, updated_at)
    SELECT DISTINCT
        ewi.ex_text,
        NOW(),
        NOW()
    FROM examples_with_index ewi
    WHERE NOT EXISTS (
        SELECT 1 FROM existing_examples ee WHERE ee.example = ewi.ex_text
    )
    RETURNING id as example_id, example
),
all_examples AS (
    -- Combine existing and new examples
    SELECT example_id, example FROM existing_examples
    UNION ALL
    SELECT example_id, example FROM new_examples
),
link_examples AS (
    -- Link examples to persona via junction table
    INSERT INTO persona_examples (persona_id, example_id, idx, created_at)
    SELECT 
        np.persona_id::uuid,
        ae.example_id,
        ewi.idx,
        NOW()
    FROM new_persona np
    CROSS JOIN examples_with_index ewi
    JOIN all_examples ae ON ae.example = ewi.ex_text
)
SELECT persona_id FROM new_persona
