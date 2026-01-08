-- Create persona with department links in a single transaction
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
        WHERE proname = 'api_create_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_persona_v4(
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role::text,
        x.department_ids
    ) as validation_passed
    FROM params x
    CROSS JOIN user_profile up
),
actor_profile AS (
    SELECT 
        x.profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
-- Insert name into names table and get ID
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description into descriptions table and get ID
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
-- Insert color into colors table and get ID
color_resource AS (
    INSERT INTO colors (name, description, hex_code, created_at, updated_at)
    SELECT 'persona_color', 'Persona color', color, NOW(), NOW()
    FROM params
    WHERE color IS NOT NULL AND color != ''
    ON CONFLICT (hex_code) DO UPDATE SET updated_at = NOW()
    RETURNING id as color_id
),
-- Insert icon into icons table and get ID
icon_resource AS (
    INSERT INTO icons (name, description, value, created_at, updated_at)
    SELECT 'persona_icon', 'Persona icon', icon, NOW(), NOW()
    FROM params
    WHERE icon IS NOT NULL AND icon != ''
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as icon_id
),
new_persona AS (
    -- Create persona (without name/description/active/color/icon columns)
    INSERT INTO personas (instructions, created_at, updated_at)
    SELECT x.instructions, NOW(), NOW()
    FROM params x
    RETURNING id
),
-- Link persona to name
link_persona_name AS (
    INSERT INTO persona_names (persona_id, name_id, created_at, updated_at)
    SELECT 
        np.id,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN name_resource nr
    ON CONFLICT (persona_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to description
link_persona_description AS (
    INSERT INTO persona_descriptions (persona_id, description_id, created_at, updated_at)
    SELECT 
        np.id,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN description_resource dr
    ON CONFLICT (persona_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to color
link_persona_color AS (
    INSERT INTO persona_colors (persona_id, color_id, created_at, updated_at)
    SELECT 
        np.id,
        cr.color_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN color_resource cr
    ON CONFLICT (persona_id, color_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to icon
link_persona_icon AS (
    INSERT INTO persona_icons (persona_id, icon_id, created_at, updated_at)
    SELECT 
        np.id,
        ir.icon_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN icon_resource ir
    ON CONFLICT (persona_id, icon_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona active flag
link_persona_active_flag AS (
    INSERT INTO persona_flags (persona_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        np.id,
        f.id,
        'active'::type_persona_flags,
        x.active,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (persona_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        np.id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
examples_with_index AS (
    -- Prepare examples with their index (skip composite IDs - filtered in Python)
    SELECT 
        ex_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM params x
    CROSS JOIN UNNEST(x.example_ids) as ex_text
    WHERE COALESCE(array_length(x.example_ids, 1), 0) > 0
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
        np.id,
        ae.example_id,
        ewi.idx,
        NOW()
    FROM new_persona np
    CROSS JOIN examples_with_index ewi
    JOIN all_examples ae ON ae.example = ewi.ex_text
)
SELECT 
    np.id as persona_id,
    ap.actor_name
FROM new_persona np
CROSS JOIN actor_profile ap
$$;