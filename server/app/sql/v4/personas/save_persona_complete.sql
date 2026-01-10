-- Unified save persona function - handles both create (persona_id = NULL) and update (persona_id provided)
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
        WHERE proname = 'api_save_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_persona_v4(
    name_id uuid,
    color_id uuid,
    icon_id uuid,
    instructions_id uuid,
    department_ids uuid[],
    profile_id uuid,
    example_ids uuid[],
    field_ids uuid[],
    input_persona_id uuid DEFAULT NULL,
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
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_persona_id IS NULL);
    
    -- Create or update persona first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO personas (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_persona_id;
    ELSE
        -- UPDATE path
        v_persona_id := input_persona_id;
        UPDATE personas
        SET updated_at = NOW()
        WHERE id = v_persona_id;
    END IF;
    
    -- Validate required resource IDs exist (same for both)
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
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM persona_names WHERE persona_id = v_persona_id;
        DELETE FROM persona_descriptions WHERE persona_id = v_persona_id;
        DELETE FROM persona_colors WHERE persona_id = v_persona_id;
        DELETE FROM persona_icons WHERE persona_id = v_persona_id;
        DELETE FROM persona_instructions WHERE persona_id = v_persona_id;
        DELETE FROM persona_departments WHERE persona_id = v_persona_id;
        DELETE FROM persona_fields WHERE persona_id = v_persona_id;
        DELETE FROM persona_examples WHERE persona_id = v_persona_id;
        -- Update existing active flag if it exists
        UPDATE persona_flags SET
            flag_id = COALESCE(api_save_persona_v4.active_flag_id, persona_flags.flag_id),
            value = CASE WHEN api_save_persona_v4.active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE persona_id = v_persona_id
          AND type = 'active'::type_persona_flags;
    END IF;
    
    -- Continue with persona save using SQL (persona already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_persona_id AS persona_id,
            name_id,
            description_id,
            color_id,
            icon_id,
            instructions_id,
            active_flag_id,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            profile_id,
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
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM persona_departments
        WHERE persona_departments.persona_id = (SELECT p.persona_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments
        WHERE profile_departments.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.persona_id FROM params p) IS NULL THEN
                    -- Validate create permissions
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params x CROSS JOIN user_profile up)
                ELSE
                    -- Validate update permissions
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link persona to name
    link_persona_name AS (
        INSERT INTO persona_names (persona_id, name_id, created_at, updated_at)
        SELECT 
            x.persona_id,
            x.name_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link persona to description
    link_persona_description AS (
        INSERT INTO persona_descriptions (persona_id, description_id, created_at, updated_at)
        SELECT 
            x.persona_id,
            x.description_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_descriptions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link persona to color
    link_persona_color AS (
        INSERT INTO persona_colors (persona_id, color_id, created_at, updated_at)
        SELECT 
            x.persona_id,
            x.color_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.color_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_colors_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link persona to icon
    link_persona_icon AS (
        INSERT INTO persona_icons (persona_id, icon_id, created_at, updated_at)
        SELECT 
            x.persona_id,
            x.icon_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.icon_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_icons_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link persona to instructions
    link_persona_instruction AS (
        INSERT INTO persona_instructions (persona_id, instruction_id, created_at, updated_at)
        SELECT 
            x.persona_id,
            x.instructions_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.instructions_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_instructions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Insert or update persona active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_persona_active_flag AS (
        INSERT INTO persona_flags (persona_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.persona_id,
            COALESCE(x.active_flag_id, f.id),
            'active'::type_persona_flags,
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags f
        WHERE f.name = 'active'
        ON CONFLICT ON CONSTRAINT persona_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, persona_flags.flag_id),
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
        SELECT 
            x.persona_id,
            dept_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT persona_departments_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Link fields (old ones already deleted above if update)
    link_fields AS (
        INSERT INTO persona_fields (persona_id, field_id, active, created_at, updated_at)
        SELECT 
            x.persona_id,
            field_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.field_ids) as field_id
        WHERE COALESCE(array_length(x.field_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT persona_fields_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Examples with index (old ones already deleted above if update)
    examples_with_index AS (
        SELECT 
            ex_id,
            ROW_NUMBER() OVER () - 1 as idx
        FROM params x
        CROSS JOIN UNNEST(x.example_ids) as ex_id
        WHERE COALESCE(array_length(x.example_ids, 1), 0) > 0
    ),
    link_examples AS (
        INSERT INTO persona_examples (persona_id, example_id, idx, active, created_at)
        SELECT 
            x.persona_id,
            ewi.ex_id,
            ewi.idx,
            true,
            NOW()
        FROM params x
        CROSS JOIN examples_with_index ewi
        ON CONFLICT ON CONSTRAINT persona_examples_pkey DO UPDATE SET
            idx = EXCLUDED.idx,
            active = true,
            created_at = EXCLUDED.created_at
    )
    SELECT 
        x.persona_id AS persona_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
