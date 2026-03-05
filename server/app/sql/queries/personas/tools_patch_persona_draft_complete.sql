-- Tools layer: Patch persona draft - accepts resource IDs and creates/updates draft
-- Independent copy of patch_persona_draft_complete.sql for tools layer evolution
-- Creates draft if input_draft_id is NULL, updates if exists
-- Links resources via junction tables

DROP FUNCTION IF EXISTS tools_patch_persona_draft_v4;

-- Ensure persona draft composite types exist before function creation.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'types'
          AND t.typname = 'persona_resource_action'
    ) THEN
        CREATE TYPE types.persona_resource_action AS (
            resources_id uuid,
            create_tool_id uuid,
            link_tool_id uuid
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'types'
          AND t.typname = 'persona_multi_resource_action'
    ) THEN
        CREATE TYPE types.persona_multi_resource_action AS (
            resource_ids uuid[],
            create_tool_id uuid,
            link_tool_id uuid
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION tools_patch_persona_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
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
    voices types.persona_multi_resource_action DEFAULT NULL,
    expected_version integer DEFAULT 0,
    active_value boolean DEFAULT true
)
RETURNS TABLE (
    draft_id uuid,
    new_version integer,
    draft_exists boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_draft_id uuid;
    v_new_version integer;
    v_draft_exists boolean := false;
    v_current_version integer;
BEGIN
    -- Check if draft exists
    IF input_draft_id IS NOT NULL THEN
        SELECT pd.id, pd.version INTO v_draft_id, v_current_version
        FROM persona_draft pd
        WHERE pd.id = input_draft_id;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;

            -- Optimistic concurrency check
            IF v_current_version != expected_version THEN
                RAISE EXCEPTION 'Draft version mismatch: expected %, got %', expected_version, v_current_version;
            END IF;
        END IF;
    END IF;

    -- Create or update draft
    IF v_draft_exists THEN
        -- Update existing draft
        v_new_version := v_current_version + 1;
        UPDATE persona_draft
        SET version = v_new_version,
            updated_at = NOW(),
            active = active_value
        WHERE id = v_draft_id;
    ELSE
        -- Create new draft
        v_new_version := 1;
        INSERT INTO persona_draft (
            profile_id, version, created_at, updated_at, active
        )
        VALUES (
            profile_id, v_new_version, NOW(), NOW(), active_value
        )
        RETURNING id INTO v_draft_id;
    END IF;

    -- Link single-select resources (upsert pattern)
    -- Names
    IF (names).resources_id IS NOT NULL THEN
        INSERT INTO persona_draft_names_junction (draft_id, names_id, active, created_at)
        VALUES (v_draft_id, (names).resources_id, true, NOW())
        ON CONFLICT (draft_id, names_id) DO UPDATE SET active = true, created_at = NOW();

        -- Deactivate other names for this draft
        UPDATE persona_draft_names_junction
        SET active = false
        WHERE draft_id = v_draft_id AND names_id != (names).resources_id;
    END IF;

    -- Descriptions
    IF (descriptions).resources_id IS NOT NULL THEN
        INSERT INTO persona_draft_descriptions_junction (draft_id, descriptions_id, active, created_at)
        VALUES (v_draft_id, (descriptions).resources_id, true, NOW())
        ON CONFLICT (draft_id, descriptions_id) DO UPDATE SET active = true, created_at = NOW();

        UPDATE persona_draft_descriptions_junction
        SET active = false
        WHERE draft_id = v_draft_id AND descriptions_id != (descriptions).resources_id;
    END IF;

    -- Colors
    IF (colors).resources_id IS NOT NULL THEN
        INSERT INTO persona_draft_colors_junction (draft_id, colors_id, active, created_at)
        VALUES (v_draft_id, (colors).resources_id, true, NOW())
        ON CONFLICT (draft_id, color_id) DO UPDATE SET active = true, created_at = NOW();

        UPDATE persona_draft_colors_junction
        SET active = false
        WHERE draft_id = v_draft_id AND colors_id != (colors).resources_id;
    END IF;

    -- Icons
    IF (icons).resources_id IS NOT NULL THEN
        INSERT INTO persona_draft_icons_junction (draft_id, icons_id, active, created_at)
        VALUES (v_draft_id, (icons).resources_id, true, NOW())
        ON CONFLICT (draft_id, icon_id) DO UPDATE SET active = true, created_at = NOW();

        UPDATE persona_draft_icons_junction
        SET active = false
        WHERE draft_id = v_draft_id AND icons_id != (icons).resources_id;
    END IF;

    -- Instructions
    IF (instructions).resources_id IS NOT NULL THEN
        INSERT INTO persona_draft_instructions_junction (draft_id, instructions_id, active, created_at)
        VALUES (v_draft_id, (instructions).resources_id, true, NOW())
        ON CONFLICT (draft_id, instructions_id) DO UPDATE SET active = true, created_at = NOW();

        UPDATE persona_draft_instructions_junction
        SET active = false
        WHERE draft_id = v_draft_id AND instructions_id != (instructions).resources_id;
    END IF;

    -- Flags
    IF (flags).resources_id IS NOT NULL THEN
        INSERT INTO persona_draft_flags_junction (draft_id, flags_id, value, created_at)
        VALUES (v_draft_id, (flags).resources_id, true, NOW())
        ON CONFLICT (draft_id, flag_id) DO UPDATE SET value = true, created_at = NOW();

        -- Deactivate other flags of same type
        UPDATE persona_draft_flags_junction
        SET value = false
        WHERE draft_id = v_draft_id AND flags_id != (flags).resources_id;
    END IF;

    -- Link multi-select resources (replace pattern)
    -- Departments
    IF (departments).resource_ids IS NOT NULL THEN
        -- Deactivate all existing
        UPDATE persona_draft_departments_junction
        SET active = false
        WHERE draft_id = v_draft_id;

        -- Insert new
        INSERT INTO persona_draft_departments_junction (draft_id, departments_id, active, created_at)
        SELECT v_draft_id, dept_id, true, NOW()
        FROM UNNEST((departments).resource_ids) AS dept_id
        ON CONFLICT (draft_id, department_id) DO UPDATE SET active = true, created_at = NOW();
    END IF;

    -- Parameter fields
    IF (parameter_fields).resource_ids IS NOT NULL THEN
        UPDATE persona_draft_parameter_fields_junction
        SET active = false
        WHERE draft_id = v_draft_id;

        INSERT INTO persona_draft_parameter_fields_junction (draft_id, parameter_fields_id, active, created_at)
        SELECT v_draft_id, field_id, true, NOW()
        FROM UNNEST((parameter_fields).resource_ids) AS field_id
        ON CONFLICT (draft_id, parameter_fields_id) DO UPDATE SET active = true, created_at = NOW();
    END IF;

    -- Examples
    IF (examples).resource_ids IS NOT NULL THEN
        UPDATE persona_draft_examples_junction
        SET active = false
        WHERE draft_id = v_draft_id;

        INSERT INTO persona_draft_examples_junction (draft_id, examples_id, active, created_at)
        SELECT v_draft_id, ex_id, true, NOW()
        FROM UNNEST((examples).resource_ids) AS ex_id
        ON CONFLICT (draft_id, examples_id) DO UPDATE SET
            active = true,
            created_at = NOW();
    END IF;

    -- Parameters
    IF (parameters).resource_ids IS NOT NULL THEN
        UPDATE persona_draft_parameters_junction
        SET active = false
        WHERE draft_id = v_draft_id;

        INSERT INTO persona_draft_parameters_junction (draft_id, parameter_id, active, created_at)
        SELECT v_draft_id, param_id, true, NOW()
        FROM UNNEST((parameters).resource_ids) AS param_id
        ON CONFLICT (draft_id, parameter_id) DO UPDATE SET active = true, created_at = NOW();
    END IF;

    -- Voices
    IF (voices).resource_ids IS NOT NULL THEN
        UPDATE persona_draft_voices_junction
        SET active = false
        WHERE draft_id = v_draft_id;

        INSERT INTO persona_draft_voices_junction (draft_id, voice_id, active, created_at)
        SELECT v_draft_id, vid, true, NOW()
        FROM UNNEST((voices).resource_ids) AS vid
        ON CONFLICT (draft_id, voice_id) DO UPDATE SET active = true, created_at = NOW();
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
