-- Tools layer: Unified save persona function - handles both create and update
-- Independent copy of save_persona_complete.sql for tools layer evolution
-- Accepts flat resource IDs directly. Denormalized personas_resource created by Python.

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'tools_save_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS tools_save_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION tools_save_persona_v4(
    profile_id uuid,
    input_persona_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    color_id uuid DEFAULT NULL,
    icon_id uuid DEFAULT NULL,
    instructions_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    parameter_field_ids uuid[] DEFAULT NULL,
    example_ids uuid[] DEFAULT NULL,
    voice_ids uuid[] DEFAULT NULL,
    personas_resource_id uuid DEFAULT NULL,
    active_value boolean DEFAULT true
)
RETURNS TABLE (
    persona_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_persona_id uuid;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_persona_id IS NULL);

    -- Validate required fields (only on create)
    IF is_create THEN
        IF name_id IS NULL THEN
            RAISE EXCEPTION 'Name resource is required';
        END IF;

        IF color_id IS NULL THEN
            RAISE EXCEPTION 'Color resource is required';
        END IF;

        IF icon_id IS NULL THEN
            RAISE EXCEPTION 'Icon resource is required';
        END IF;

        IF instructions_id IS NULL THEN
            RAISE EXCEPTION 'Instructions resource is required';
        END IF;
    END IF;

    -- Create or update persona_artifact
    IF is_create THEN
        INSERT INTO persona_artifact (created_at, updated_at, active)
        VALUES (NOW(), NOW(), active_value)
        RETURNING id INTO v_persona_id;
    ELSE
        v_persona_id := input_persona_id;
        UPDATE persona_artifact
        SET updated_at = NOW()
        WHERE id = v_persona_id;

        -- COALESCE: fill NULL params from existing active junctions (partial update support)
        -- Single-select resources
        IF name_id IS NULL THEN
            name_id := (SELECT j.name_id FROM persona_names_junction j WHERE j.persona_id = v_persona_id AND j.active LIMIT 1);
        END IF;
        IF description_id IS NULL THEN
            description_id := (SELECT j.description_id FROM persona_descriptions_junction j WHERE j.persona_id = v_persona_id AND j.active LIMIT 1);
        END IF;
        IF color_id IS NULL THEN
            color_id := (SELECT j.color_id FROM persona_colors_junction j WHERE j.persona_id = v_persona_id AND j.active LIMIT 1);
        END IF;
        IF icon_id IS NULL THEN
            icon_id := (SELECT j.icon_id FROM persona_icons_junction j WHERE j.persona_id = v_persona_id AND j.active LIMIT 1);
        END IF;
        IF instructions_id IS NULL THEN
            instructions_id := (SELECT j.instruction_id FROM persona_instructions_junction j WHERE j.persona_id = v_persona_id AND j.active LIMIT 1);
        END IF;

        -- Multi-select arrays: preserve existing if NULL passed
        IF department_ids IS NULL THEN
            department_ids := COALESCE((SELECT ARRAY_AGG(j.department_id) FROM persona_departments_junction j WHERE j.persona_id = v_persona_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF parameter_field_ids IS NULL THEN
            parameter_field_ids := COALESCE((SELECT ARRAY_AGG(j.parameter_field_id) FROM persona_parameter_fields_junction j WHERE j.persona_id = v_persona_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF example_ids IS NULL THEN
            example_ids := COALESCE((SELECT ARRAY_AGG(j.example_id ORDER BY j.idx) FROM persona_examples_junction j WHERE j.persona_id = v_persona_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF voice_ids IS NULL THEN
            voice_ids := COALESCE((SELECT ARRAY_AGG(j.voice_id) FROM persona_voices_junction j WHERE j.persona_id = v_persona_id AND j.active), ARRAY[]::uuid[]);
        END IF;

        -- Flag: preserve existing active flag if not provided
        IF active_flag_id IS NULL THEN
            active_flag_id := (SELECT j.flag_id FROM persona_flags_junction j WHERE j.persona_id = v_persona_id AND j.value = true LIMIT 1);
        END IF;
    END IF;

    -- Create personas_resource inline if not provided (partial update path)
    IF personas_resource_id IS NULL THEN
        INSERT INTO personas_resource (
            name, description, icon, color, department_ids,
            instructions, examples, parameter_field_ids, mcp, generated
        )
        SELECT
            n.name,
            d.description,
            ic.value,
            c.hex_code,
            COALESCE(tools_save_persona_v4.department_ids, ARRAY[]::uuid[]),
            ins.template,
            COALESCE(
                (SELECT ARRAY_AGG(e.example ORDER BY idx.ord)
                 FROM UNNEST(COALESCE(tools_save_persona_v4.example_ids, ARRAY[]::uuid[])) WITH ORDINALITY AS idx(id, ord)
                 JOIN examples_resource e ON e.id = idx.id),
                ARRAY[]::text[]
            ),
            COALESCE(tools_save_persona_v4.parameter_field_ids, ARRAY[]::uuid[]),
            false,
            false
        FROM (SELECT 1) AS dummy
        LEFT JOIN names_resource n ON n.id = tools_save_persona_v4.name_id
        LEFT JOIN descriptions_resource d ON d.id = tools_save_persona_v4.description_id
        LEFT JOIN icons_resource ic ON ic.id = tools_save_persona_v4.icon_id
        LEFT JOIN colors_resource c ON c.id = tools_save_persona_v4.color_id
        LEFT JOIN instructions_resource ins ON ins.id = tools_save_persona_v4.instructions_id
        RETURNING id INTO personas_resource_id;
    END IF;

    -- For update: deactivate old junction rows (preserves history)
    IF NOT is_create THEN
        UPDATE persona_names_junction SET active = false WHERE persona_id = v_persona_id AND active = true;
        UPDATE persona_descriptions_junction SET active = false WHERE persona_id = v_persona_id AND active = true;
        UPDATE persona_colors_junction SET active = false WHERE persona_id = v_persona_id AND active = true;
        UPDATE persona_icons_junction SET active = false WHERE persona_id = v_persona_id AND active = true;
        UPDATE persona_instructions_junction SET active = false WHERE persona_id = v_persona_id AND active = true;
        UPDATE persona_departments_junction SET active = false WHERE persona_id = v_persona_id AND active = true;
        UPDATE persona_parameter_fields_junction SET active = false WHERE persona_id = v_persona_id AND active = true;
        UPDATE persona_examples_junction SET active = false WHERE persona_id = v_persona_id AND active = true;
        UPDATE persona_voices_junction SET active = false WHERE persona_id = v_persona_id AND active = true;
    END IF;

    -- Upsert junction rows
    RETURN QUERY
    WITH params AS (
        SELECT
            v_persona_id AS persona_id,
            tools_save_persona_v4.name_id AS name_id,
            tools_save_persona_v4.description_id AS description_id,
            tools_save_persona_v4.color_id AS color_id,
            tools_save_persona_v4.icon_id AS icon_id,
            tools_save_persona_v4.instructions_id AS instructions_id,
            tools_save_persona_v4.active_flag_id AS active_flag_id,
            tools_save_persona_v4.department_ids AS department_ids,
            tools_save_persona_v4.parameter_field_ids AS parameter_field_ids,
            tools_save_persona_v4.example_ids AS example_ids,
            tools_save_persona_v4.voice_ids AS voice_ids,
            tools_save_persona_v4.personas_resource_id AS personas_resource_id
    ),
    -- Link name
    link_name AS (
        INSERT INTO persona_names_junction (persona_id, name_id, active, created_at)
        SELECT x.persona_id, x.name_id, active_value, NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_names_pkey DO UPDATE SET active = active_value
    ),
    -- Link description
    link_description AS (
        INSERT INTO persona_descriptions_junction (persona_id, description_id, active, created_at)
        SELECT x.persona_id, x.description_id, active_value, NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_descriptions_pkey DO UPDATE SET active = active_value
    ),
    -- Link color
    link_color AS (
        INSERT INTO persona_colors_junction (persona_id, color_id, active, created_at)
        SELECT x.persona_id, x.color_id, active_value, NOW()
        FROM params x
        WHERE x.color_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_colors_pkey DO UPDATE SET active = active_value
    ),
    -- Link icon
    link_icon AS (
        INSERT INTO persona_icons_junction (persona_id, icon_id, active, created_at)
        SELECT x.persona_id, x.icon_id, active_value, NOW()
        FROM params x
        WHERE x.icon_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_icons_pkey DO UPDATE SET active = active_value
    ),
    -- Link instructions
    link_instruction AS (
        INSERT INTO persona_instructions_junction (persona_id, instruction_id, active, created_at)
        SELECT x.persona_id, x.instructions_id, active_value, NOW()
        FROM params x
        WHERE x.instructions_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_instructions_pkey DO UPDATE SET active = active_value
    ),
    -- Upsert active flag
    upsert_flag AS (
        INSERT INTO persona_flags_junction (persona_id, flag_id, value, created_at)
        SELECT x.persona_id,
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
    -- Link departments
    link_departments AS (
        INSERT INTO persona_departments_junction (persona_id, department_id, active, created_at)
        SELECT x.persona_id, dept_id, active_value, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) AS dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT persona_departments_pkey DO UPDATE SET active = active_value
    ),
    -- Link parameter fields
    link_parameter_fields AS (
        INSERT INTO persona_parameter_fields_junction (persona_id, parameter_field_id, active, created_at)
        SELECT x.persona_id, field_id, active_value, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.parameter_field_ids) AS field_id
        WHERE COALESCE(array_length(x.parameter_field_ids, 1), 0) > 0
        ON CONFLICT (persona_id, parameter_field_id) DO UPDATE SET active = active_value
    ),
    -- Link examples (with ordering)
    examples_with_index AS (
        SELECT ex_id, ROW_NUMBER() OVER () - 1 AS idx
        FROM params x
        CROSS JOIN UNNEST(x.example_ids) AS ex_id
        WHERE COALESCE(array_length(x.example_ids, 1), 0) > 0
    ),
    link_examples AS (
        INSERT INTO persona_examples_junction (persona_id, example_id, idx, active, created_at)
        SELECT x.persona_id, ewi.ex_id, ewi.idx, active_value, NOW()
        FROM params x
        CROSS JOIN examples_with_index ewi
        ON CONFLICT ON CONSTRAINT persona_examples_pkey DO UPDATE SET
            idx = EXCLUDED.idx,
            active = active_value,
            created_at = EXCLUDED.created_at
    ),
    -- Link voices
    link_voices AS (
        INSERT INTO persona_voices_junction (persona_id, voice_id, active, created_at)
        SELECT x.persona_id, vid, active_value, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.voice_ids) AS vid
        WHERE COALESCE(array_length(x.voice_ids, 1), 0) > 0
        ON CONFLICT (persona_id, voice_id) DO UPDATE SET active = active_value
    ),
    -- Deactivate old personas_resource link
    deactivate_old_resource AS (
        UPDATE persona_personas_junction
        SET active = false
        FROM params p
        WHERE persona_personas_junction.persona_id = p.persona_id
          AND persona_personas_junction.active = true
    ),
    -- Link pre-created personas_resource
    link_new_resource AS (
        INSERT INTO persona_personas_junction (persona_id, personas_id, active)
        SELECT x.persona_id, x.personas_resource_id, active_value
        FROM params x
        WHERE x.personas_resource_id IS NOT NULL
    )
    SELECT x.persona_id AS persona_id
    FROM params x;
END;
$$;
