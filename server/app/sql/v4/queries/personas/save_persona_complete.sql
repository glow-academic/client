-- Unified save persona function - handles both create (input_persona_id = NULL) and update (input_persona_id provided)
-- Accepts flat resource IDs directly. Tool call tracking handled by create/link internals.
-- Denormalized personas_resource created by Python (create_personas_internal).

-- Drop function if exists (handles signature variations)
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
    profile_id uuid,
    input_persona_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    color_id uuid DEFAULT NULL,
    icon_id uuid DEFAULT NULL,
    instructions_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    parameter_field_ids uuid[] DEFAULT ARRAY[]::uuid[],
    example_ids uuid[] DEFAULT ARRAY[]::uuid[],
    voice_ids uuid[] DEFAULT ARRAY[]::uuid[],
    personas_resource_id uuid DEFAULT NULL
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
    -- Validate required fields
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

    -- Determine if create or update
    is_create := (input_persona_id IS NULL);

    -- Create or update persona_artifact
    IF is_create THEN
        INSERT INTO persona_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_persona_id;
    ELSE
        v_persona_id := input_persona_id;
        UPDATE persona_artifact
        SET updated_at = NOW()
        WHERE id = v_persona_id;
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
            api_save_persona_v4.name_id AS name_id,
            api_save_persona_v4.description_id AS description_id,
            api_save_persona_v4.color_id AS color_id,
            api_save_persona_v4.icon_id AS icon_id,
            api_save_persona_v4.instructions_id AS instructions_id,
            api_save_persona_v4.active_flag_id AS active_flag_id,
            api_save_persona_v4.department_ids AS department_ids,
            api_save_persona_v4.parameter_field_ids AS parameter_field_ids,
            api_save_persona_v4.example_ids AS example_ids,
            api_save_persona_v4.voice_ids AS voice_ids,
            api_save_persona_v4.personas_resource_id AS personas_resource_id
    ),
    -- Link name
    link_name AS (
        INSERT INTO persona_names_junction (persona_id, name_id, active, created_at)
        SELECT x.persona_id, x.name_id, true, NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_names_pkey DO UPDATE SET active = true
    ),
    -- Link description
    link_description AS (
        INSERT INTO persona_descriptions_junction (persona_id, description_id, active, created_at)
        SELECT x.persona_id, x.description_id, true, NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_descriptions_pkey DO UPDATE SET active = true
    ),
    -- Link color
    link_color AS (
        INSERT INTO persona_colors_junction (persona_id, color_id, active, created_at)
        SELECT x.persona_id, x.color_id, true, NOW()
        FROM params x
        WHERE x.color_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_colors_pkey DO UPDATE SET active = true
    ),
    -- Link icon
    link_icon AS (
        INSERT INTO persona_icons_junction (persona_id, icon_id, active, created_at)
        SELECT x.persona_id, x.icon_id, true, NOW()
        FROM params x
        WHERE x.icon_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_icons_pkey DO UPDATE SET active = true
    ),
    -- Link instructions
    link_instruction AS (
        INSERT INTO persona_instructions_junction (persona_id, instruction_id, active, created_at)
        SELECT x.persona_id, x.instructions_id, true, NOW()
        FROM params x
        WHERE x.instructions_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT persona_instructions_pkey DO UPDATE SET active = true
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
        SELECT x.persona_id, dept_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) AS dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT persona_departments_pkey DO UPDATE SET active = true
    ),
    -- Link parameter fields
    link_parameter_fields AS (
        INSERT INTO persona_parameter_fields_junction (persona_id, parameter_field_id, active, created_at)
        SELECT x.persona_id, field_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.parameter_field_ids) AS field_id
        WHERE COALESCE(array_length(x.parameter_field_ids, 1), 0) > 0
        ON CONFLICT (persona_id, parameter_field_id) DO UPDATE SET active = true
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
        SELECT x.persona_id, ewi.ex_id, ewi.idx, true, NOW()
        FROM params x
        CROSS JOIN examples_with_index ewi
        ON CONFLICT ON CONSTRAINT persona_examples_pkey DO UPDATE SET
            idx = EXCLUDED.idx,
            active = true,
            created_at = EXCLUDED.created_at
    ),
    -- Link voices
    link_voices AS (
        INSERT INTO persona_voices_junction (persona_id, voice_id, active, created_at)
        SELECT x.persona_id, vid, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.voice_ids) AS vid
        WHERE COALESCE(array_length(x.voice_ids, 1), 0) > 0
        ON CONFLICT (persona_id, voice_id) DO UPDATE SET active = true
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
        SELECT x.persona_id, x.personas_resource_id, true
        FROM params x
        WHERE x.personas_resource_id IS NOT NULL
    )
    SELECT x.persona_id AS persona_id
    FROM params x;
END;
$$;
