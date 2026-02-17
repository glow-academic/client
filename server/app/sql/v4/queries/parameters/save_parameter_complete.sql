-- Unified save parameter function - handles both create (input_parameter_id = NULL) and update (input_parameter_id provided)
-- Uses nested resource action composites with tool call tracking.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.parameter_resource_action CASCADE;
    CREATE TYPE types.parameter_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.parameter_multi_resource_action CASCADE;
    CREATE TYPE types.parameter_multi_resource_action AS (
        resource_ids uuid[],
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_parameter_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_parameter_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_parameter_v4(
    profile_id uuid,
    group_id uuid,
    input_parameter_id uuid DEFAULT NULL,
    names types.parameter_resource_action DEFAULT NULL,
    descriptions types.parameter_resource_action DEFAULT NULL,
    flags types.parameter_multi_resource_action DEFAULT NULL,
    departments types.parameter_multi_resource_action DEFAULT NULL,
    fields types.parameter_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    parameter_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
#variable_conflict use_column
DECLARE
    v_parameter_id uuid;
    v_group_id uuid;
    v_profile_id uuid;
    v_input_parameter_id uuid;
    is_create boolean;

    v_name_id uuid;
    v_description_id uuid;
    v_flag_ids uuid[];
    v_department_ids uuid[];
    v_field_ids uuid[];

    -- Denormalized booleans on parameters_resource
    v_persona_parameter boolean := false;
    v_document_parameter boolean := false;
    v_scenario_parameter boolean := false;
    v_video_parameter boolean := false;

    -- Tool-call tracking
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_parameter_id := input_parameter_id;

    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_flag_ids := COALESCE((flags).resource_ids, ARRAY[]::uuid[]);
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_field_ids := COALESCE((fields).resource_ids, ARRAY[]::uuid[]);

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    is_create := (v_input_parameter_id IS NULL);

    IF is_create THEN
        INSERT INTO parameter_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_parameter_id;
    ELSE
        v_parameter_id := v_input_parameter_id;
        UPDATE parameter_artifact
        SET updated_at = NOW()
        WHERE id = v_parameter_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Parameter not found: %', v_input_parameter_id;
        END IF;
    END IF;

    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_flag_ids) AS fid
        WHERE NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = fid)
    ) THEN
        RAISE EXCEPTION 'One or more flag_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_department_ids) AS did
        WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = did)
    ) THEN
        RAISE EXCEPTION 'One or more department_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_field_ids) AS fid
        WHERE NOT EXISTS (SELECT 1 FROM fields_resource WHERE id = fid)
    ) THEN
        RAISE EXCEPTION 'One or more field_ids not found';
    END IF;

    -- Parameter-type flags for denormalized parameters_resource fields
    SELECT EXISTS (
        SELECT 1 FROM flags_resource f
        WHERE f.id = ANY(v_flag_ids)
          AND f.name IN ('parameter_persona', 'persona')
    ) INTO v_persona_parameter;

    SELECT EXISTS (
        SELECT 1 FROM flags_resource f
        WHERE f.id = ANY(v_flag_ids)
          AND f.name IN ('parameter_document', 'document')
    ) INTO v_document_parameter;

    SELECT EXISTS (
        SELECT 1 FROM flags_resource f
        WHERE f.id = ANY(v_flag_ids)
          AND f.name IN ('parameter_scenario', 'scenario')
    ) INTO v_scenario_parameter;

    SELECT EXISTS (
        SELECT 1 FROM flags_resource f
        WHERE f.id = ANY(v_flag_ids)
          AND f.name IN ('parameter_video', 'video')
    ) INTO v_video_parameter;

    -- Update workflow semantics: replace active junctions for current artifact state.
    IF NOT is_create THEN
        DELETE FROM parameter_names_junction WHERE parameter_id = v_parameter_id;
        DELETE FROM parameter_descriptions_junction WHERE parameter_id = v_parameter_id;
        DELETE FROM parameter_departments_junction WHERE parameter_id = v_parameter_id;
        DELETE FROM parameter_fields_junction WHERE parameter_id = v_parameter_id;
        DELETE FROM parameter_flags_junction WHERE parameter_id = v_parameter_id;

        UPDATE parameter_parameters_junction
        SET active = false
        WHERE parameter_id = v_parameter_id
          AND active = true;
    END IF;

    -- Tool-call tracking: one run per save.
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, group_id, created_at, updated_at)
    VALUES (v_run_id, v_group_id, NOW(), NOW());

    IF v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    IF COALESCE(array_length(v_flag_ids, 1), 0) > 0 THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
        END IF;

        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;

        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;
    END IF;

    IF COALESCE(array_length(v_field_ids, 1), 0) > 0 THEN
        IF (fields).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_create_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((fields).create_tool_id, v_call_id);
            INSERT INTO fields_calls_connection (fields_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_field_ids) fid;
        END IF;

        IF (fields).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'parameter_save_link_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((fields).link_tool_id, v_call_id);
            INSERT INTO fields_calls_connection (fields_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_field_ids) fid;
        END IF;
    END IF;

    RETURN QUERY
    WITH params AS (
        SELECT
            v_parameter_id AS parameter_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_flag_ids AS flag_ids,
            v_department_ids AS department_ids,
            v_field_ids AS field_ids,
            v_profile_id AS profile_id,
            v_persona_parameter AS persona_parameter,
            v_document_parameter AS document_parameter,
            v_scenario_parameter AS scenario_parameter,
            v_video_parameter AS video_parameter
    ),
    link_parameter_name AS (
        INSERT INTO parameter_names_junction (parameter_id, name_id, created_at)
        SELECT x.parameter_id, x.name_id, NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT parameter_names_pkey DO NOTHING
    ),
    link_parameter_description AS (
        INSERT INTO parameter_descriptions_junction (parameter_id, description_id, created_at)
        SELECT x.parameter_id, x.description_id, NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT parameter_descriptions_pkey DO NOTHING
    ),
    -- Active flag is always present; true iff parameter_active was selected.
    upsert_parameter_active_flag AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, value, created_at)
        SELECT
            x.parameter_id,
            f.id,
            EXISTS (
                SELECT 1
                FROM UNNEST(x.flag_ids) AS selected_flag_id
                WHERE selected_flag_id = f.id
            ) AS value,
            NOW()
        FROM params x
        JOIN flags_resource f ON f.name = 'parameter_active'
        ON CONFLICT ON CONSTRAINT parameter_flags_pkey DO UPDATE SET
            value = EXCLUDED.value,
            created_at = EXCLUDED.created_at
    ),
    -- Other flags: set selected flags to true (excluding the canonical active flag).
    upsert_parameter_selected_flags AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, value, created_at)
        SELECT
            x.parameter_id,
            selected_flag_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.flag_ids) AS selected_flag_id
        WHERE selected_flag_id NOT IN (
            SELECT id FROM flags_resource WHERE name = 'parameter_active'
        )
        ON CONFLICT ON CONSTRAINT parameter_flags_pkey DO UPDATE SET
            value = true,
            created_at = EXCLUDED.created_at
    ),
    link_departments AS (
        INSERT INTO parameter_departments_junction (parameter_id, department_id, active, created_at)
        SELECT
            x.parameter_id,
            dept_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT parameter_departments_pkey DO UPDATE SET
            active = true
    ),
    link_fields_to_parameter AS (
        INSERT INTO parameter_fields_junction (parameter_id, field_id, created_at)
        SELECT
            x.parameter_id,
            field_id,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.field_ids) AS field_id
        WHERE COALESCE(array_length(x.field_ids, 1), 0) > 0
          AND EXISTS (
              SELECT 1
              FROM field_flags_junction ff
              JOIN flags_resource fr ON fr.id = ff.flag_id
              WHERE ff.field_id = field_id
                AND fr.name = 'field_active'
                AND ff.value = true
          )
        ON CONFLICT ON CONSTRAINT parameter_fields_pkey DO NOTHING
    ),
    create_new_resource AS (
        INSERT INTO parameters_resource (
            name,
            description,
            department_ids,
            field_ids,
            persona_parameter,
            document_parameter,
            scenario_parameter,
            video_parameter,
            active
        )
        SELECT
            n.name,
            d.description,
            x.department_ids,
            x.field_ids,
            x.persona_parameter,
            x.document_parameter,
            x.scenario_parameter,
            x.video_parameter,
            EXISTS (
                SELECT 1
                FROM UNNEST(x.flag_ids) AS selected_flag_id
                JOIN flags_resource f ON f.id = selected_flag_id
                WHERE f.name = 'parameter_active'
            )
        FROM params x
        LEFT JOIN names_resource n ON n.id = x.name_id
        LEFT JOIN descriptions_resource d ON d.id = x.description_id
        RETURNING id AS new_parameters_resource_id
    ),
    link_new_resource AS (
        INSERT INTO parameter_parameters_junction (parameter_id, parameters_id, active)
        SELECT p.parameter_id, cnr.new_parameters_resource_id, true
        FROM params p
        CROSS JOIN create_new_resource cnr
    )
    SELECT
        x.parameter_id AS parameter_id
    FROM params x;
END;
$$;

