-- Update persona with department links in a single transaction
-- Parameters: $1=personaId, $2=name, $3=description, $4=active, $5=color, $6=icon, $7=instructions, $8=department_ids (nullable text array), $9=profile_id (uuid), $10=example_ids (nullable text array)
WITH user_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $9::uuid
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
    FROM UNNEST($8::text[]) as dept_id
    WHERE COALESCE(array_length($8::text[], 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_parameters AS (
    -- Soft-delete removed parameters (set active = false for parameters not in new list)
    UPDATE parameter_personas
    SET active = false, updated_at = NOW()
    WHERE persona_id = $1::uuid
    AND active = true
    AND (
        COALESCE(array_length($10::text[], 1), 0) = 0
        OR parameter_id NOT IN (SELECT unnest($10::text[])::uuid)
    )
),
link_parameters AS (
    -- Insert or reactivate parameter links if provided (array is never NULL, but may be empty)
    INSERT INTO parameter_personas (parameter_id, persona_id, active, created_at, updated_at)
    SELECT 
        param_id::uuid,
        $1::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($10::text[]) as param_id
    WHERE COALESCE(array_length($10::text[], 1), 0) > 0
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
    WHERE pp.persona_id = $1::uuid
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
replace_examples AS (
    -- Delete all existing example links
    DELETE FROM persona_examples 
    WHERE persona_id = $1::uuid
),
examples_with_index AS (
    -- Prepare examples with their index
    SELECT 
        ex_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST($10::text[]) as ex_text
    WHERE EXISTS (SELECT 1 FROM update_persona)
      AND COALESCE(array_length($10::text[], 1), 0) > 0
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
insert_examples AS (
    -- Link examples to persona via junction table
    INSERT INTO persona_examples (persona_id, example_id, idx, created_at)
    SELECT 
        $1::uuid,
        ae.example_id,
        ewi.idx,
        NOW()
    FROM examples_with_index ewi
    JOIN all_examples ae ON ae.example = ewi.ex_text
)
SELECT 
    up.persona_id,
    ap.actor_name
FROM update_persona up
CROSS JOIN user_profile ap
