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
    
    -- Continue with persona creation using SQL
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
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role::text,
        x.department_ids::text[]
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
new_persona AS (
    -- Create persona (without name/description/active/color/icon/instructions columns)
    INSERT INTO personas (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params x
    RETURNING id
),
-- Link persona to name
link_persona_name AS (
    INSERT INTO persona_names (persona_id, name_id, created_at, updated_at)
    SELECT 
        np.id,
        x.name_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    WHERE x.name_id IS NOT NULL
    ON CONFLICT (persona_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to description
link_persona_description AS (
    INSERT INTO persona_descriptions (persona_id, description_id, created_at, updated_at)
    SELECT 
        np.id,
        x.description_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    WHERE x.description_id IS NOT NULL
    ON CONFLICT (persona_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to color
link_persona_color AS (
    INSERT INTO persona_colors (persona_id, color_id, created_at, updated_at)
    SELECT 
        np.id,
        x.color_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    WHERE x.color_id IS NOT NULL
    ON CONFLICT (persona_id, color_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to icon
link_persona_icon AS (
    INSERT INTO persona_icons (persona_id, icon_id, created_at, updated_at)
    SELECT 
        np.id,
        x.icon_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    WHERE x.icon_id IS NOT NULL
    ON CONFLICT (persona_id, icon_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to instructions
link_persona_instruction AS (
    INSERT INTO persona_instructions (persona_id, instruction_id, created_at, updated_at)
    SELECT 
        np.id,
        x.instructions_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    WHERE x.instructions_id IS NOT NULL
    ON CONFLICT (persona_id, instruction_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona active flag (use active_flag_id if provided, otherwise use 'active' flag with value=false)
link_persona_active_flag AS (
    INSERT INTO persona_flags (persona_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        np.id,
        COALESCE(x.active_flag_id, f.id),
        'active'::type_persona_flags,
        CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (persona_id, flag_id, type) DO UPDATE SET 
        flag_id = COALESCE(x.active_flag_id, f.id),
        value = CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
        updated_at = NOW()
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        np.id,
        dept_id,
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
link_fields AS (
    -- Link fields if provided (array is never NULL, but may be empty)
    INSERT INTO persona_fields (persona_id, field_id, active, created_at, updated_at)
    SELECT 
        np.id,
        field_id,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.field_ids) as field_id
    WHERE COALESCE(array_length(x.field_ids, 1), 0) > 0
    ON CONFLICT (persona_id, field_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
examples_with_index AS (
    -- Prepare examples with their index (example_ids are now UUIDs)
    SELECT 
        ex_id,
        ROW_NUMBER() OVER () - 1 as idx
    FROM params x
    CROSS JOIN UNNEST(x.example_ids) as ex_id
    WHERE COALESCE(array_length(x.example_ids, 1), 0) > 0
),
link_examples AS (
    -- Link examples to persona via junction table (using provided UUIDs)
    INSERT INTO persona_examples (persona_id, example_id, idx, active, created_at)
    SELECT 
        np.id,
        ewi.ex_id,
        ewi.idx,
        true,
        NOW()
    FROM new_persona np
    CROSS JOIN examples_with_index ewi
    ON CONFLICT (persona_id, example_id) DO UPDATE SET
        idx = EXCLUDED.idx,
        active = true,
        created_at = EXCLUDED.created_at
)
SELECT 
    np.id as persona_id,
    ap.actor_name
FROM new_persona np
CROSS JOIN actor_profile ap;
END;
$$;