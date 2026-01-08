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
    persona_id uuid,
    name text,
    description text,
    active boolean,
    color text,
    icon text,
    instructions text,
    department_ids text[],
    profile_id uuid,
    example_ids text[],
    field_ids text[]
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
        COALESCE(example_ids, ARRAY[]::text[]) AS example_ids,
        COALESCE(field_ids, ARRAY[]::text[]) AS field_ids
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
-- Insert/update name in names table
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert/update description in descriptions table
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
-- Insert/update color in colors table
color_resource AS (
    INSERT INTO colors (name, description, hex_code, created_at, updated_at)
    SELECT 'persona_color', 'Persona color', color, NOW(), NOW()
    FROM params
    WHERE color IS NOT NULL AND color != ''
    ON CONFLICT (hex_code) DO UPDATE SET updated_at = NOW()
    RETURNING id as color_id
),
-- Insert/update icon in icons table
icon_resource AS (
    INSERT INTO icons (name, description, value, created_at, updated_at)
    SELECT 'persona_icon', 'Persona icon', icon, NOW(), NOW()
    FROM params
    WHERE icon IS NOT NULL AND icon != ''
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as icon_id
),
update_persona AS (
    -- Update persona (without name/description/active/color/icon/instructions columns)
    UPDATE personas
    SET 
        updated_at = NOW()
    FROM params x
    WHERE id = x.persona_id
    RETURNING id
),
-- Update instruction if provided
update_or_create_instruction AS (
    -- Delete existing instruction links
    DELETE FROM persona_instructions
    WHERE persona_id = (SELECT persona_id FROM params)
      AND (SELECT instructions FROM params) IS NOT NULL
),
create_or_update_instruction AS (
    INSERT INTO instructions (template, active, created_at, updated_at)
    SELECT 
        x.instructions,
        true,
        NOW(),
        NOW()
    FROM params x
    WHERE x.instructions IS NOT NULL AND x.instructions != ''
    ON CONFLICT DO NOTHING
    RETURNING id as instruction_id
),
get_existing_instruction AS (
    SELECT id as instruction_id
    FROM instructions
    WHERE template = (SELECT instructions FROM params)
    LIMIT 1
),
target_instruction AS (
    SELECT COALESCE(
        (SELECT instruction_id FROM create_or_update_instruction LIMIT 1),
        (SELECT instruction_id FROM get_existing_instruction LIMIT 1)
    ) as instruction_id
    FROM params
    WHERE instructions IS NOT NULL AND instructions != ''
    LIMIT 1
),
link_persona_instruction AS (
    INSERT INTO persona_instructions (persona_id, instruction_id, created_at, updated_at)
    SELECT 
        up.id,
        ti.instruction_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN target_instruction ti
    WHERE ti.instruction_id IS NOT NULL
    ON CONFLICT (persona_id, instruction_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old name links
remove_old_name AS (
    DELETE FROM persona_names
    WHERE persona_id = (SELECT persona_id FROM params)
      AND name_id NOT IN (SELECT name_id FROM name_resource)
),
-- Link persona to new name
link_persona_name AS (
    INSERT INTO persona_names (persona_id, name_id, created_at, updated_at)
    SELECT 
        up.id,
        nr.name_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN name_resource nr
    ON CONFLICT (persona_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old description links
remove_old_description AS (
    DELETE FROM persona_descriptions
    WHERE persona_id = (SELECT persona_id FROM params)
      AND description_id NOT IN (SELECT description_id FROM description_resource)
),
-- Link persona to new description
link_persona_description AS (
    INSERT INTO persona_descriptions (persona_id, description_id, created_at, updated_at)
    SELECT 
        up.id,
        dr.description_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN description_resource dr
    ON CONFLICT (persona_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old color links
remove_old_color AS (
    DELETE FROM persona_colors
    WHERE persona_id = (SELECT persona_id FROM params)
      AND color_id NOT IN (SELECT color_id FROM color_resource)
),
-- Link persona to new color
link_persona_color AS (
    INSERT INTO persona_colors (persona_id, color_id, created_at, updated_at)
    SELECT 
        up.id,
        cr.color_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN color_resource cr
    ON CONFLICT (persona_id, color_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old icon links
remove_old_icon AS (
    DELETE FROM persona_icons
    WHERE persona_id = (SELECT persona_id FROM params)
      AND icon_id NOT IN (SELECT icon_id FROM icon_resource)
),
-- Link persona to new icon
link_persona_icon AS (
    INSERT INTO persona_icons (persona_id, icon_id, created_at, updated_at)
    SELECT 
        up.id,
        ir.icon_id,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN icon_resource ir
    ON CONFLICT (persona_id, icon_id) DO UPDATE SET updated_at = NOW()
),
-- Update persona active flag
update_persona_active_flag AS (
    UPDATE persona_flags SET
        value = (SELECT active FROM params),
        updated_at = NOW()
    WHERE persona_id = (SELECT persona_id FROM params)
      AND type = 'active'::type_persona_flags
),
insert_persona_active_flag AS (
    INSERT INTO persona_flags (persona_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        up.id,
        f.id,
        'active'::type_persona_flags,
        x.active,
        NOW(),
        NOW()
    FROM update_persona up
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
      AND NOT EXISTS (SELECT 1 FROM persona_flags pf WHERE pf.persona_id = up.id AND pf.type = 'active'::type_persona_flags)
    ON CONFLICT (persona_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
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
replace_fields AS (
    -- Delete all existing field links
    DELETE FROM persona_fields WHERE persona_id = (SELECT persona_id FROM params)
),
link_fields AS (
    -- Insert new field links if provided (array is never NULL, but may be empty)
    INSERT INTO persona_fields (persona_id, field_id, active, created_at, updated_at)
    SELECT 
        x.persona_id,
        field_id::uuid,
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
    INSERT INTO persona_examples (persona_id, example_id, idx, active, created_at)
    SELECT 
        x.persona_id,
        ae.example_id,
        ewi.idx,
        true,
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