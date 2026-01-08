-- Update persona with department links in a single transaction
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_update_persona_v4(
    input_persona_id uuid,
    name_id uuid,
    color_id uuid,
    icon_id uuid,
    instructions_id uuid,
    department_ids uuid[],
    profile_id uuid,
    example_ids uuid[],
    field_ids uuid[],
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL
)
RETURNS TABLE (
    persona_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_persona_id uuid;
    v_actor_name text;
BEGIN
    -- Store parameter in local variable
    v_persona_id := input_persona_id;
    
    -- Validate required resource IDs exist
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    
    IF color_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM colors WHERE id = color_id) THEN
        RAISE EXCEPTION 'Color resource not found: %', color_id;
    END IF;
    
    IF icon_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM icons WHERE id = icon_id) THEN
        RAISE EXCEPTION 'Icon resource not found: %', icon_id;
    END IF;
    
    IF instructions_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instructions WHERE id = instructions_id) THEN
        RAISE EXCEPTION 'Instructions resource not found: %', instructions_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    
    -- Continue with persona update using SQL
    RETURN QUERY
    WITH params AS (
        SELECT
            name_id AS name_id,
            description_id AS description_id,
            color_id AS color_id,
            icon_id AS icon_id,
            instructions_id AS instructions_id,
            active_flag_id AS active_flag_id,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            profile_id AS profile_id,
            COALESCE(example_ids, ARRAY[]::uuid[]) AS example_ids,
            COALESCE(field_ids, ARRAY[]::uuid[]) AS field_ids
    ),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
object_current_departments AS (
    -- Get persona's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM persona_departments
    WHERE persona_id = v_persona_id AND active = true
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
    -- Update persona (without name/description/active/color/icon/instructions columns)
    UPDATE personas
    SET 
        updated_at = NOW()
    WHERE id = api_update_persona_v4.persona_id
    RETURNING id
),
-- Remove old name links and link new name
remove_old_name AS (
    DELETE FROM persona_names
    WHERE persona_id = v_persona_id
),
link_persona_name AS (
    INSERT INTO persona_names (persona_id, name_id, created_at, updated_at)
    SELECT 
        up.id,
        x.name_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN params x
    WHERE x.name_id IS NOT NULL
    ON CONFLICT (persona_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old description links and link new description
remove_old_description AS (
    DELETE FROM persona_descriptions
    WHERE persona_id = v_persona_id
),
link_persona_description AS (
    INSERT INTO persona_descriptions (persona_id, description_id, created_at, updated_at)
    SELECT 
        up.id,
        x.description_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN params x
    WHERE x.description_id IS NOT NULL
    ON CONFLICT (persona_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old color links and link new color
remove_old_color AS (
    DELETE FROM persona_colors
    WHERE persona_id = v_persona_id
),
link_persona_color AS (
    INSERT INTO persona_colors (persona_id, color_id, created_at, updated_at)
    SELECT 
        up.id,
        x.color_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN params x
    WHERE x.color_id IS NOT NULL
    ON CONFLICT (persona_id, color_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old icon links and link new icon
remove_old_icon AS (
    DELETE FROM persona_icons
    WHERE persona_id = v_persona_id
),
link_persona_icon AS (
    INSERT INTO persona_icons (persona_id, icon_id, created_at, updated_at)
    SELECT 
        up.id,
        x.icon_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN params x
    WHERE x.icon_id IS NOT NULL
    ON CONFLICT (persona_id, icon_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old instruction links and link new instruction
remove_old_instruction AS (
    DELETE FROM persona_instructions
    WHERE persona_id = v_persona_id
),
link_persona_instruction AS (
    INSERT INTO persona_instructions (persona_id, instruction_id, created_at, updated_at)
    SELECT 
        up.id,
        x.instructions_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN params x
    WHERE x.instructions_id IS NOT NULL
    ON CONFLICT (persona_id, instruction_id) DO UPDATE SET updated_at = NOW()
),
-- Update persona active flag
update_persona_active_flag AS (
    UPDATE persona_flags SET
        flag_id = COALESCE((SELECT active_flag_id FROM params), flag_id),
        value = CASE WHEN (SELECT active_flag_id FROM params) IS NOT NULL THEN true ELSE false END,
        updated_at = NOW()
    WHERE persona_id = v_persona_id
      AND type = 'active'::type_persona_flags
),
insert_persona_active_flag AS (
    INSERT INTO persona_flags (persona_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        up.id,
        COALESCE(x.active_flag_id, f.id),
        'active'::type_persona_flags,
        CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
      AND NOT EXISTS (SELECT 1 FROM persona_flags pf WHERE pf.persona_id = up.id AND pf.type = 'active'::type_persona_flags)
    ON CONFLICT (persona_id, flag_id, type) DO UPDATE SET 
        flag_id = COALESCE(x.active_flag_id, f.id),
        value = CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
        updated_at = NOW()
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM persona_departments WHERE persona_id = (SELECT input_persona_id FROM params)
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        v_persona_id,
        dept_id,
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
replace_fields AS (
    -- Delete all existing field links
    DELETE FROM persona_fields WHERE persona_id = (SELECT input_persona_id FROM params)
),
link_fields AS (
    -- Insert new field links if provided (array is never NULL, but may be empty)
    INSERT INTO persona_fields (persona_id, field_id, active, created_at, updated_at)
    SELECT 
        v_persona_id,
        field_id,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.field_ids) as field_id
    WHERE COALESCE(array_length(x.field_ids, 1), 0) > 0
    ON CONFLICT (persona_id, field_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_examples AS (
    -- Delete all existing example links
    DELETE FROM persona_examples 
    WHERE persona_id = v_persona_id
),
examples_with_index AS (
    -- Prepare examples with their index (example_ids are now UUIDs)
    SELECT 
        ex_id,
        ROW_NUMBER() OVER () - 1 as idx
    FROM params x
    CROSS JOIN UNNEST(x.example_ids) as ex_id
    WHERE EXISTS (SELECT 1 FROM update_persona)
      AND COALESCE(array_length(x.example_ids, 1), 0) > 0
),
insert_examples AS (
    -- Link examples to persona via junction table (using provided UUIDs)
    INSERT INTO persona_examples (persona_id, example_id, idx, active, created_at)
    SELECT 
        v_persona_id,
        ewi.ex_id,
        ewi.idx,
        true,
        NOW()
    FROM params x
    CROSS JOIN examples_with_index ewi
    ON CONFLICT (persona_id, example_id) DO UPDATE SET
        idx = EXCLUDED.idx,
        active = true,
        created_at = EXCLUDED.created_at
)
SELECT 
    up.id as persona_id,
    ap.actor_name
FROM update_persona up
CROSS JOIN actor_profile ap;
END;
$$;