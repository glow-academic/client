-- Unified save field function - handles both create and update.
-- Uses nested resource action composites with tool call tracking.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.field_resource_action CASCADE;
    CREATE TYPE types.field_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.field_multi_resource_action CASCADE;
    CREATE TYPE types.field_multi_resource_action AS (
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
        WHERE proname = 'api_save_field_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_field_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_field_v4(
    profile_id uuid,
    group_id uuid,
    input_field_id uuid DEFAULT NULL,
    names types.field_resource_action DEFAULT NULL,
    descriptions types.field_resource_action DEFAULT NULL,
    flags types.field_resource_action DEFAULT NULL,
    departments types.field_multi_resource_action DEFAULT NULL,
    conditional_parameters types.field_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    field_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
#variable_conflict use_column
DECLARE
    v_field_id uuid;
    v_profile_id uuid;
    v_group_id uuid;
    v_input_field_id uuid;
    is_create boolean;

    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_department_ids uuid[];
    v_conditional_parameter_ids uuid[];

    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_field_id := input_field_id;

    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_conditional_parameter_ids := COALESCE((conditional_parameters).resource_ids, ARRAY[]::uuid[]);

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    is_create := (v_input_field_id IS NULL);

    IF is_create THEN
        INSERT INTO field_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_field_id;
    ELSE
        v_field_id := v_input_field_id;
        UPDATE field_artifact
        SET updated_at = NOW()
        WHERE id = v_field_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Field not found: %', v_input_field_id;
        END IF;
    END IF;

    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_department_ids) AS did
        WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = did)
    ) THEN
        RAISE EXCEPTION 'One or more department_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_conditional_parameter_ids) AS pid
        WHERE NOT EXISTS (SELECT 1 FROM parameters_resource WHERE id = pid)
    ) THEN
        RAISE EXCEPTION 'One or more conditional_parameter_ids not found';
    END IF;

    IF NOT is_create THEN
        DELETE FROM field_names_junction WHERE field_id = v_field_id;
        DELETE FROM field_descriptions_junction WHERE field_id = v_field_id;
        DELETE FROM field_departments_junction WHERE field_id = v_field_id;
        UPDATE field_conditional_parameters_junction
        SET active = false
        WHERE field_id = v_field_id;

        UPDATE field_flags_junction SET
            flag_id = COALESCE(v_active_flag_id, field_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE field_id = v_field_id;

        UPDATE field_fields_junction
        SET active = false
        WHERE field_id = v_field_id AND active = true;
    END IF;

    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (v_run_id, 0, 0, 0, v_group_id, NOW(), NOW());

    IF v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;
    END IF;

    IF COALESCE(array_length(v_conditional_parameter_ids, 1), 0) > 0 THEN
        IF (conditional_parameters).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_create_conditional_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((conditional_parameters).create_tool_id, v_call_id);
            INSERT INTO parameters_calls_connection (parameters_id, call_id)
            SELECT pid, v_call_id FROM UNNEST(v_conditional_parameter_ids) pid;
        END IF;
        IF (conditional_parameters).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'field_save_link_conditional_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((conditional_parameters).link_tool_id, v_call_id);
            INSERT INTO parameters_calls_connection (parameters_id, call_id)
            SELECT pid, v_call_id FROM UNNEST(v_conditional_parameter_ids) pid;
        END IF;
    END IF;

    RETURN QUERY
    WITH params AS (
        SELECT
            v_field_id AS field_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_conditional_parameter_ids AS conditional_parameter_ids,
            v_department_ids AS department_ids
    ),
    link_field_name AS (
        INSERT INTO field_names_junction (field_id, name_id, created_at)
        SELECT x.field_id, x.name_id, NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT (field_id, name_id) DO NOTHING
    ),
    link_field_description AS (
        INSERT INTO field_descriptions_junction (field_id, description_id, created_at)
        SELECT x.field_id, x.description_id, NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT (field_id, description_id) DO NOTHING
    ),
    insert_field_active_flag AS (
        INSERT INTO field_flags_junction (field_id, flag_id, type, value, created_at)
        SELECT
            x.field_id,
            COALESCE(x.active_flag_id, f.id),
            'active'::type_field_flags,
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'field_active'
        ON CONFLICT (field_id, flag_id, type) DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, field_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    ensure_conditional_parameters AS (
        INSERT INTO conditional_parameters_resource (parameter_id, created_at, updated_at)
        SELECT param_id, NOW(), NOW()
        FROM params x
        CROSS JOIN UNNEST(x.conditional_parameter_ids) as param_id
        WHERE COALESCE(array_length(x.conditional_parameter_ids, 1), 0) > 0
        ON CONFLICT (parameter_id) DO NOTHING
    ),
    link_conditional_parameters AS (
        INSERT INTO field_conditional_parameters_junction (field_id, conditional_parameter_id, active, created_at)
        SELECT
            x.field_id,
            cpr.id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.conditional_parameter_ids) as param_id
        JOIN conditional_parameters_resource cpr ON cpr.parameter_id = param_id
        WHERE COALESCE(array_length(x.conditional_parameter_ids, 1), 0) > 0
        ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
            active = true
    ),
    link_departments AS (
        INSERT INTO field_departments_junction (field_id, department_id, active, created_at)
        SELECT x.field_id, dept_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT (field_id, department_id) DO UPDATE SET
            active = true
    ),
    create_new_resource AS (
        INSERT INTO fields_resource (name, description, conditional_parameter_ids)
        SELECT
            n.name,
            d.description,
            p.conditional_parameter_ids
        FROM params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        RETURNING id AS new_fields_resource_id
    ),
    link_new_resource AS (
        INSERT INTO field_fields_junction (field_id, fields_id, active)
        SELECT p.field_id, cnr.new_fields_resource_id, true
        FROM params p
        CROSS JOIN create_new_resource cnr
    )
    SELECT x.field_id AS field_id
    FROM params x;
END;
$$;

