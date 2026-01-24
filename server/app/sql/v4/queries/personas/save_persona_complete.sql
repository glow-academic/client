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
    draft_id uuid,
    profile_id uuid,
    input_persona_id uuid DEFAULT NULL
)
RETURNS TABLE (
    persona_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_persona_id uuid;
    v_actor_name text;
    v_group_id uuid;
    v_draft_profile_id uuid;
    v_draft_id uuid;
    v_profile_id uuid;
    v_input_persona_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_color_id uuid;
    v_icon_id uuid;
    v_instructions_id uuid;
    v_active_flag_id uuid;
    v_department_ids uuid[];
    v_example_ids uuid[];
    v_field_ids uuid[];
BEGIN
    v_draft_id := draft_id;
    v_profile_id := profile_id;
    v_input_persona_id := input_persona_id;

    IF v_draft_id IS NULL THEN
        RAISE EXCEPTION 'Draft ID is required';
    END IF;

    SELECT pdj.profile_id, d.group_id
    INTO v_draft_profile_id, v_group_id
    FROM drafts_entry d
    LEFT JOIN profile_drafts_junction pdj ON pdj.draft_id = d.id
    WHERE d.id = v_draft_id;

    IF v_draft_profile_id IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', v_draft_id;
    END IF;

    IF v_draft_profile_id <> v_profile_id THEN
        RAISE EXCEPTION 'Draft does not belong to profile';
    END IF;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Draft group_id not found: %', v_draft_id;
    END IF;

    -- Load draft resources
    SELECT dn.names_id INTO v_name_id
    FROM names_draft dn
    WHERE dn.draft_id = v_draft_id
    LIMIT 1;

    SELECT dd.descriptions_id INTO v_description_id
    FROM descriptions_draft dd
    WHERE dd.draft_id = v_draft_id
    LIMIT 1;

    SELECT dc.colors_id INTO v_color_id
    FROM colors_draft dc
    WHERE dc.draft_id = v_draft_id
    LIMIT 1;

    SELECT di.icons_id INTO v_icon_id
    FROM icons_draft di
    WHERE di.draft_id = v_draft_id
    LIMIT 1;

    SELECT din.instructions_id INTO v_instructions_id
    FROM instructions_draft din
    WHERE din.draft_id = v_draft_id
    LIMIT 1;

    SELECT df.flags_id INTO v_active_flag_id
    FROM flags_draft df
    WHERE df.draft_id = v_draft_id
    LIMIT 1;

    SELECT COALESCE(ARRAY_AGG(ddp.departments_id ORDER BY ddp.created_at), ARRAY[]::uuid[])
    INTO v_department_ids
    FROM departments_draft ddp
    WHERE ddp.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(de.examples_id ORDER BY de.created_at), ARRAY[]::uuid[])
    INTO v_example_ids
    FROM examples_draft de
    WHERE de.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(dfld.fields_id ORDER BY dfld.created_at), ARRAY[]::uuid[])
    INTO v_field_ids
    FROM fields_draft dfld
    WHERE dfld.draft_id = v_draft_id;

    -- Determine if create or update
    is_create := (v_input_persona_id IS NULL);
    
    -- Create or UPDATE persona_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO persona_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_persona_id;
        -- Link group via junction table
        INSERT INTO persona_groups_junction (persona_id, group_id)
        VALUES (v_persona_id, v_group_id)
        ON CONFLICT DO NOTHING;
    ELSE
        -- UPDATE path
        v_persona_id := v_input_persona_id;
        UPDATE persona_artifact
        SET updated_at = NOW()
        WHERE id = v_persona_id;
        -- Upsert group via junction table
        INSERT INTO persona_groups_junction (persona_id, group_id)
        VALUES (v_persona_id, v_group_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Validate required resource IDs exist (same for both)
    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;
    
    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;
    
    IF v_color_id IS NULL THEN
        RAISE EXCEPTION 'Color resource is required';
    END IF;

    IF v_color_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM colors_resource WHERE id = v_color_id) THEN
        RAISE EXCEPTION 'Color resource not found: %', v_color_id;
    END IF;
    
    IF v_icon_id IS NULL THEN
        RAISE EXCEPTION 'Icon resource is required';
    END IF;

    IF v_icon_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM icons_resource WHERE id = v_icon_id) THEN
        RAISE EXCEPTION 'Icon resource not found: %', v_icon_id;
    END IF;
    
    IF v_instructions_id IS NULL THEN
        RAISE EXCEPTION 'Instructions resource is required';
    END IF;

    IF v_instructions_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instructions_resource WHERE id = v_instructions_id) THEN
        RAISE EXCEPTION 'Instructions resource not found: %', v_instructions_id;
    END IF;
    
    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM persona_names_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_descriptions_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_colors_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_icons_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_instructions_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_departments_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_fields_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_examples_junction WHERE persona_id = v_persona_id;
        -- Update existing active flag if it exists
        UPDATE persona_flags_junction SET
            flag_id = COALESCE(v_active_flag_id, persona_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE persona_id = v_persona_id
          ;
    END IF;
    
    -- Continue with persona save using SQL (persona already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_persona_id AS persona_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_color_id AS color_id,
            v_icon_id AS icon_id,
            v_instructions_id AS instructions_id,
            v_active_flag_id AS active_flag_id,
            COALESCE(v_department_ids, ARRAY[]::uuid[]) AS department_ids,
            v_profile_id AS profile_id,
            COALESCE(v_example_ids, ARRAY[]::uuid[]) AS example_ids,
            COALESCE(v_field_ids, ARRAY[]::uuid[]) AS field_ids
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM persona_departments_junction
        WHERE persona_departments_junction.persona_id = (SELECT p.persona_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments_junction
        WHERE profile_departments_junction.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
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
        INSERT INTO persona_names_junction (persona_id, name_id, created_at)
        SELECT 
            x.persona_id,
            x.name_id,
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_names_pkey DO NOTHING
    ),
    -- Link persona to description
    link_persona_description AS (
        INSERT INTO persona_descriptions_junction (persona_id, description_id, created_at)
        SELECT 
            x.persona_id,
            x.description_id,
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_descriptions_pkey DO NOTHING
    ),
    -- Link persona to color
    link_persona_color AS (
        INSERT INTO persona_colors_junction (persona_id, color_id, created_at)
        SELECT 
            x.persona_id,
            x.color_id,
            NOW()
        FROM params x
        WHERE x.color_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_colors_pkey DO NOTHING
    ),
    -- Link persona to icon
    link_persona_icon AS (
        INSERT INTO persona_icons_junction (persona_id, icon_id, created_at)
        SELECT 
            x.persona_id,
            x.icon_id,
            NOW()
        FROM params x
        WHERE x.icon_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_icons_pkey DO NOTHING
    ),
    -- Link persona to instructions
    link_persona_instruction AS (
        INSERT INTO persona_instructions_junction (persona_id, instruction_id, created_at)
        SELECT 
            x.persona_id,
            x.instructions_id,
            NOW()
        FROM params x
        WHERE x.instructions_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_instructions_pkey DO NOTHING
    ),
    -- Insert or UPDATE persona_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_persona_active_flag AS (
        INSERT INTO persona_flags_junction (persona_id, flag_id, value, created_at) SELECT x.persona_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'persona_active'
        ON CONFLICT ON CONSTRAINT persona_flags_pkey DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, persona_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO persona_departments_junction (persona_id, department_id, active, created_at)
        SELECT 
            x.persona_id,
            dept_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT persona_departments_pkey DO UPDATE SET
            active = true
    ),
    -- Link fields (old ones already deleted above if update)
    link_fields AS (
        INSERT INTO persona_fields_junction (persona_id, field_id, active, created_at)
        SELECT 
            x.persona_id,
            field_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.field_ids) as field_id
        WHERE COALESCE(array_length(x.field_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT persona_fields_pkey DO UPDATE SET
            active = true
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
        INSERT INTO persona_examples_junction (persona_id, example_id, idx, active, created_at)
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
