-- Unified save persona function - handles both create (input_persona_id = NULL) and update (input_persona_id provided)
-- Accepts form fields directly (no draft_id dependency)

-- 0) Drop and recreate composite types for resource actions
DO $$
BEGIN
    DROP TYPE IF EXISTS types.persona_resource_action CASCADE;
    CREATE TYPE types.persona_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.persona_multi_resource_action CASCADE;
    CREATE TYPE types.persona_multi_resource_action AS (
        resource_ids uuid[],
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1) Drop function first (breaks dependency on types)
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

-- 2) Recreate function with composite resource action parameters
CREATE OR REPLACE FUNCTION api_save_persona_v4(
    profile_id uuid,
    input_persona_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.persona_resource_action DEFAULT NULL,
    descriptions types.persona_resource_action DEFAULT NULL,
    colors types.persona_resource_action DEFAULT NULL,
    icons types.persona_resource_action DEFAULT NULL,
    instructions types.persona_resource_action DEFAULT NULL,
    flags types.persona_resource_action DEFAULT NULL,
    departments types.persona_multi_resource_action DEFAULT NULL,
    parameter_fields types.persona_multi_resource_action DEFAULT NULL,
    examples types.persona_multi_resource_action DEFAULT NULL,
    parameters types.persona_multi_resource_action DEFAULT NULL,
    voices types.persona_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    persona_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
#variable_conflict use_column
DECLARE
    v_persona_id uuid;
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
    v_parameter_field_ids uuid[];
    v_parameter_ids uuid[];
    v_voice_ids uuid[];
    -- Call tracking variables
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Assign parameters to local variables (extract from composites)
    v_profile_id := profile_id;
    v_input_persona_id := input_persona_id;
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_color_id := (colors).resource_id;
    v_icon_id := (icons).resource_id;
    v_instructions_id := (instructions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_parameter_field_ids := COALESCE((parameter_fields).resource_ids, ARRAY[]::uuid[]);
    v_example_ids := COALESCE((examples).resource_ids, ARRAY[]::uuid[]);
    v_parameter_ids := COALESCE((parameters).resource_ids, ARRAY[]::uuid[]);
    v_voice_ids := COALESCE((voices).resource_ids, ARRAY[]::uuid[]);

    -- Validate required fields
    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    IF v_color_id IS NULL THEN
        RAISE EXCEPTION 'Color resource is required';
    END IF;

    IF v_icon_id IS NULL THEN
        RAISE EXCEPTION 'Icon resource is required';
    END IF;

    IF v_instructions_id IS NULL THEN
        RAISE EXCEPTION 'Instructions resource is required';
    END IF;

    -- Determine if create or update
    is_create := (v_input_persona_id IS NULL);

    -- Create or UPDATE persona_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO persona_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_persona_id;
    ELSE
        -- UPDATE path
        v_persona_id := v_input_persona_id;
        UPDATE persona_artifact
        SET updated_at = NOW()
        WHERE id = v_persona_id;
    END IF;

    -- Validate resource IDs exist
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_color_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM colors_resource WHERE id = v_color_id) THEN
        RAISE EXCEPTION 'Color resource not found: %', v_color_id;
    END IF;

    IF v_icon_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM icons_resource WHERE id = v_icon_id) THEN
        RAISE EXCEPTION 'Icon resource not found: %', v_icon_id;
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
        DELETE FROM persona_parameter_fields_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_examples_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_parameters_junction WHERE persona_id = v_persona_id;
        DELETE FROM persona_voices_junction WHERE persona_id = v_persona_id;
        -- Update existing active flag if it exists
        UPDATE persona_flags_junction SET
            flag_id = COALESCE(v_active_flag_id, persona_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE persona_id = v_persona_id;
    END IF;

    -- === TOOL CALL TRACKING ===
    -- Create single run for the group if any tool IDs present
    IF group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, group_id, NOW(), NOW());
    END IF;

    -- names
    IF v_run_id IS NOT NULL AND v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    -- descriptions
    IF v_run_id IS NOT NULL AND v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    -- colors
    IF v_run_id IS NOT NULL AND v_color_id IS NOT NULL THEN
        IF (colors).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((colors).create_tool_id, v_call_id);
            INSERT INTO colors_calls_connection (colors_id, call_id) VALUES (v_color_id, v_call_id);
        END IF;
        IF (colors).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((colors).link_tool_id, v_call_id);
            INSERT INTO colors_calls_connection (colors_id, call_id) VALUES (v_color_id, v_call_id);
        END IF;
    END IF;

    -- icons
    IF v_run_id IS NOT NULL AND v_icon_id IS NOT NULL THEN
        IF (icons).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_icons_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((icons).create_tool_id, v_call_id);
            INSERT INTO icons_calls_connection (icons_id, call_id) VALUES (v_icon_id, v_call_id);
        END IF;
        IF (icons).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_icons_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((icons).link_tool_id, v_call_id);
            INSERT INTO icons_calls_connection (icons_id, call_id) VALUES (v_icon_id, v_call_id);
        END IF;
    END IF;

    -- instructions
    IF v_run_id IS NOT NULL AND v_instructions_id IS NOT NULL THEN
        IF (instructions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_instructions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((instructions).create_tool_id, v_call_id);
            INSERT INTO instructions_calls_connection (instructions_id, call_id) VALUES (v_instructions_id, v_call_id);
        END IF;
        IF (instructions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_instructions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((instructions).link_tool_id, v_call_id);
            INSERT INTO instructions_calls_connection (instructions_id, call_id) VALUES (v_instructions_id, v_call_id);
        END IF;
    END IF;

    -- flags
    IF v_run_id IS NOT NULL AND v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    -- departments (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
    END IF;

    -- parameter_fields (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_parameter_field_ids, 1), 0) > 0 THEN
        IF (parameter_fields).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameter_fields).create_tool_id, v_call_id);
            INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
            SELECT field_id, v_call_id FROM UNNEST(v_parameter_field_ids) AS field_id;
        END IF;
        IF (parameter_fields).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameter_fields).link_tool_id, v_call_id);
            INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
            SELECT field_id, v_call_id FROM UNNEST(v_parameter_field_ids) AS field_id;
        END IF;
    END IF;

    -- examples (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_example_ids, 1), 0) > 0 THEN
        IF (examples).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_examples_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((examples).create_tool_id, v_call_id);
            INSERT INTO examples_calls_connection (examples_id, call_id)
            SELECT ex_id, v_call_id FROM UNNEST(v_example_ids) AS ex_id;
        END IF;
        IF (examples).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_examples_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((examples).link_tool_id, v_call_id);
            INSERT INTO examples_calls_connection (examples_id, call_id)
            SELECT ex_id, v_call_id FROM UNNEST(v_example_ids) AS ex_id;
        END IF;
    END IF;

    -- parameters (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_parameter_ids, 1), 0) > 0 THEN
        IF (parameters).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameters).create_tool_id, v_call_id);
            INSERT INTO parameters_calls_connection (parameters_id, call_id)
            SELECT param_id, v_call_id FROM UNNEST(v_parameter_ids) AS param_id;
        END IF;
        IF (parameters).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameters).link_tool_id, v_call_id);
            INSERT INTO parameters_calls_connection (parameters_id, call_id)
            SELECT param_id, v_call_id FROM UNNEST(v_parameter_ids) AS param_id;
        END IF;
    END IF;

    -- voices (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_voice_ids, 1), 0) > 0 THEN
        IF (voices).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_voices_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).create_tool_id, v_call_id);
            INSERT INTO voices_calls_connection (voices_id, call_id)
            SELECT voice_id, v_call_id FROM UNNEST(v_voice_ids) AS voice_id;
        END IF;
        IF (voices).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_voices_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).link_tool_id, v_call_id);
            INSERT INTO voices_calls_connection (voices_id, call_id)
            SELECT voice_id, v_call_id FROM UNNEST(v_voice_ids) AS voice_id;
        END IF;
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
            v_department_ids AS department_ids,
            v_parameter_field_ids AS parameter_field_ids,
            v_example_ids AS example_ids,
            v_parameter_ids AS parameter_ids,
            v_voice_ids AS voice_ids
    ),
    -- Permission validation is now handled in Python (permissions.py)
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
        WHERE f.type = 'persona_active'
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
    -- Link parameter fields (old ones already deleted above if update)
    link_parameter_fields AS (
        INSERT INTO persona_parameter_fields_junction (persona_id, parameter_field_id, active, created_at)
        SELECT
            x.persona_id,
            field_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.parameter_field_ids) as field_id
        WHERE COALESCE(array_length(x.parameter_field_ids, 1), 0) > 0
        ON CONFLICT (persona_id, parameter_field_id) DO UPDATE SET
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
    ),
    -- Link parameters (old ones already deleted above if update)
    link_parameters AS (
        INSERT INTO persona_parameters_junction (persona_id, parameter_id, active, created_at)
        SELECT
            x.persona_id,
            param_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.parameter_ids) as param_id
        WHERE COALESCE(array_length(x.parameter_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT persona_parameters_pkey DO UPDATE SET
            active = true
    ),
    -- Link voices (old ones already deleted above if update)
    link_voices AS (
        INSERT INTO persona_voices_junction (persona_id, voice_id, active, created_at)
        SELECT
            x.persona_id,
            vid,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.voice_ids) as vid
        WHERE COALESCE(array_length(x.voice_ids, 1), 0) > 0
        ON CONFLICT (persona_id, voice_id) DO UPDATE SET
            active = true
    ),
    -- Deactivate old persona resource junction entries
    deactivate_old_resource AS (
        UPDATE persona_personas_junction
        SET active = false
        FROM params p
        WHERE persona_personas_junction.persona_id = p.persona_id
          AND persona_personas_junction.active = true
    ),
    -- Create new personas_resource with denormalized fields
    create_new_resource AS (
        INSERT INTO personas_resource (name, description, icon, color, department_ids, instructions, examples)
        SELECT
            n.name,
            d.description,
            ic.value,
            c.hex_code,
            p.department_ids,
            ins.template,
            COALESCE(
                (SELECT ARRAY_AGG(e.example ORDER BY ewi.idx)
                 FROM examples_with_index ewi
                 JOIN examples_resource e ON e.id = ewi.ex_id),
                ARRAY[]::text[]
            )
        FROM params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        LEFT JOIN icons_resource ic ON ic.id = p.icon_id
        LEFT JOIN colors_resource c ON c.id = p.color_id
        LEFT JOIN instructions_resource ins ON ins.id = p.instructions_id
        RETURNING id AS new_personas_resource_id
    ),
    -- Link new resource to persona artifact
    link_new_resource AS (
        INSERT INTO persona_personas_junction (persona_id, personas_id, active)
        SELECT p.persona_id, cnr.new_personas_resource_id, true
        FROM params p
        CROSS JOIN create_new_resource cnr
    )
    SELECT
        x.persona_id AS persona_id
    FROM params x;
END;
$$;

