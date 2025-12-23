-- Update persona with department links in a single transaction
-- Parameters: $1=personaId, $2=name, $3=description, $4=active, $5=color, $6=icon, $7=instructions, $8=department_ids (nullable text array), $9=profile_id (uuid), $10=example_ids (nullable text array)
WITH user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $9::uuid
),
object_current_departments AS (
    -- Get persona's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM persona_departments
    WHERE persona_id = $1::uuid AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = $9::uuid AND active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role::text,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
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
    -- NOTE: parameter_personas table was dropped in migration 91
    -- Parameters are now linked to personas via persona_parameter flag and persona_fields
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
),
link_parameters AS (
    -- NOTE: parameter_personas table was dropped in migration 91
    -- Parameters are now linked to personas via persona_parameter flag and persona_fields
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
),
backfill_persona_fields AS (
    -- NOTE: parameter_personas table was dropped in migration 91
    -- Parameters are now linked to personas via persona_parameter flag and persona_fields
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
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
