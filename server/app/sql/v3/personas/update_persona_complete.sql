-- Update persona with department links in a single transaction
-- Converted to function

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
        WHERE proname = 'api_update_persona_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_persona_v3(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_update_persona_v3(
    persona_id uuid,
    name text,
    description text,
    active boolean,
    color text,
    icon text,
    instructions text,
    department_ids text[],
    profile_id uuid,
    example_ids text[]
)
RETURNS TABLE (
    persona_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        persona_id AS persona_id,
        name AS name,
        COALESCE(NULLIF(description, ''), '') AS description,
        active AS active,
        color AS color,
        icon AS icon,
        COALESCE(NULLIF(instructions, ''), '') AS instructions,
        COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
        profile_id AS profile_id,
        COALESCE(example_ids, ARRAY[]::text[]) AS example_ids
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
object_current_departments AS (
    -- Get persona's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM persona_departments
    WHERE persona_id = (SELECT persona_id FROM params) AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = (SELECT profile_id FROM params) AND active = true
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
actor_profile AS (
    SELECT 
        x.profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
update_persona AS (
    UPDATE personas
    SET 
        name = x.name,
        description = x.description,
        active = x.active,
        color = x.color,
        icon = x.icon,
        instructions = x.instructions,
        updated_at = NOW()
    FROM params x
    WHERE id = x.persona_id
    RETURNING id
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM persona_departments WHERE persona_id = (SELECT persona_id FROM params)
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        x.persona_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_examples AS (
    -- Delete all existing example links
    DELETE FROM persona_examples 
    WHERE persona_id = (SELECT persona_id FROM params)
),
examples_with_index AS (
    -- Prepare examples with their index
    SELECT 
        ex_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM params x
    CROSS JOIN UNNEST(x.example_ids) as ex_text
    WHERE EXISTS (SELECT 1 FROM update_persona)
      AND COALESCE(array_length(x.example_ids, 1), 0) > 0
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
        x.persona_id,
        ae.example_id,
        ewi.idx,
        NOW()
    FROM params x
    CROSS JOIN examples_with_index ewi
    JOIN all_examples ae ON ae.example = ewi.ex_text
)
SELECT 
    up.id as persona_id,
    ap.actor_name
FROM update_persona up
CROSS JOIN actor_profile ap
$$;

COMMIT;
