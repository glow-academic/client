-- Create persona with department links in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=color, $5=icon, $6=instructions, $7=department_ids (nullable text array), $8=profile_id (uuid or "guest-profile-id"), $9=example_ids (nullable text array)
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $8::uuid AND sdg.active = true
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
            WHEN $8::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $8::text IS NULL OR $8::text = '' THEN NULL::uuid
            ELSE $8::uuid
        END as resolved_profile_id
),
new_persona AS (
    INSERT INTO personas (name, description, active, color, icon, instructions, created_at, updated_at)
    VALUES ($1, COALESCE($2, ''), $3, $4, $5, COALESCE($6, ''), NOW(), NOW())
    RETURNING id::text as persona_id
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
    CROSS JOIN UNNEST($7::text[]) as dept_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    ),
examples_with_index AS (
    -- Prepare examples with their index (skip composite IDs - filtered in Python)
    SELECT 
        ex_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST($9::text[]) as ex_text
    WHERE COALESCE(array_length($9::text[], 1), 0) > 0
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
