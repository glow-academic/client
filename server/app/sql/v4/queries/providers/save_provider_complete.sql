-- Unified save provider function - section-action based (persona parity)

DO $$
BEGIN
    DROP TYPE IF EXISTS types.provider_resource_action CASCADE;
    CREATE TYPE types.provider_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.provider_multi_resource_action CASCADE;
    CREATE TYPE types.provider_multi_resource_action AS (
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
        WHERE proname = 'api_save_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_provider_v4(
    profile_id uuid,
    group_id uuid,
    input_provider_id uuid DEFAULT NULL,
    names types.provider_resource_action DEFAULT NULL,
    descriptions types.provider_resource_action DEFAULT NULL,
    flags types.provider_resource_action DEFAULT NULL,
    departments types.provider_multi_resource_action DEFAULT NULL,
    values_action types.provider_resource_action DEFAULT NULL,
    endpoints types.provider_resource_action DEFAULT NULL,
    keys types.provider_resource_action DEFAULT NULL
)
RETURNS TABLE (
    provider_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_provider_id uuid;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_value_id uuid;
    v_endpoint_id uuid;
    v_key_id uuid;
    v_department_ids uuid[];
    v_default_provider_active_flag_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_value_id := (values_action).resource_id;
    v_endpoint_id := (endpoints).resource_id;
    v_key_id := (keys).resource_id;
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);

    IF group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    IF v_value_id IS NULL THEN
        RAISE EXCEPTION 'Value resource is required';
    END IF;

    SELECT id INTO v_default_provider_active_flag_id
    FROM flags_resource
    WHERE name = 'provider_active'
    LIMIT 1;

    IF NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM values_resource WHERE id = v_value_id) THEN
        RAISE EXCEPTION 'Value resource not found: %', v_value_id;
    END IF;

    IF v_endpoint_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM endpoints_resource WHERE id = v_endpoint_id) THEN
        RAISE EXCEPTION 'Endpoint resource not found: %', v_endpoint_id;
    END IF;

    IF v_key_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM keys_resource WHERE id = v_key_id) THEN
        RAISE EXCEPTION 'Key resource not found: %', v_key_id;
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1
            FROM UNNEST(v_department_ids) AS department_id
            WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = department_id)
        ) THEN
            RAISE EXCEPTION 'One or more department resources not found';
        END IF;
    END IF;

    IF input_provider_id IS NULL THEN
        INSERT INTO provider_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_provider_id;
    ELSE
        v_provider_id := input_provider_id;

        UPDATE provider_artifact
        SET updated_at = NOW()
        WHERE id = v_provider_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Provider not found: %', input_provider_id;
        END IF;

        UPDATE provider_names_junction SET active = false WHERE provider_id = v_provider_id AND active = true;
        UPDATE provider_descriptions_junction SET active = false WHERE provider_id = v_provider_id AND active = true;
        UPDATE provider_flags_junction SET active = false WHERE provider_id = v_provider_id AND active = true;
        UPDATE provider_values_junction SET active = false WHERE provider_id = v_provider_id AND active = true;
        UPDATE provider_endpoints_junction SET active = false WHERE provider_id = v_provider_id AND active = true;
        UPDATE provider_keys_junction SET active = false WHERE provider_id = v_provider_id AND active = true;
        UPDATE provider_departments_junction SET active = false WHERE provider_id = v_provider_id AND active = true;
    END IF;

    INSERT INTO provider_names_junction (provider_id, name_id, created_at, active)
    VALUES (v_provider_id, v_name_id, NOW(), true)
    ON CONFLICT ON CONSTRAINT provider_names_pkey DO UPDATE
    SET active = true, created_at = NOW();

    IF v_description_id IS NOT NULL THEN
        INSERT INTO provider_descriptions_junction (provider_id, description_id, created_at, active)
        VALUES (v_provider_id, v_description_id, NOW(), true)
        ON CONFLICT ON CONSTRAINT provider_descriptions_pkey DO UPDATE
        SET active = true, created_at = NOW();
    END IF;

    INSERT INTO provider_flags_junction (provider_id, flag_id, value, created_at, active)
    VALUES (
        v_provider_id,
        COALESCE(v_active_flag_id, v_default_provider_active_flag_id),
        CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END,
        NOW(),
        true
    )
    ON CONFLICT ON CONSTRAINT provider_flags_pkey DO UPDATE
    SET flag_id = EXCLUDED.flag_id,
        value = EXCLUDED.value,
        active = true,
        created_at = NOW();

    INSERT INTO provider_values_junction (provider_id, values_id, created_at, active)
    VALUES (v_provider_id, v_value_id, NOW(), true)
    ON CONFLICT ON CONSTRAINT provider_values_pkey DO UPDATE
    SET active = true, created_at = NOW();

    IF v_endpoint_id IS NOT NULL THEN
        INSERT INTO provider_endpoints_junction (provider_id, endpoint_id, created_at, active)
        VALUES (v_provider_id, v_endpoint_id, NOW(), true)
        ON CONFLICT ON CONSTRAINT provider_endpoints_junction_pkey DO UPDATE
        SET active = true, created_at = NOW();
    END IF;

    IF v_key_id IS NOT NULL THEN
        INSERT INTO provider_keys_junction (provider_id, key_id, created_at, active)
        VALUES (v_provider_id, v_key_id, NOW(), true)
        ON CONFLICT ON CONSTRAINT provider_keys_junction_pkey DO UPDATE
        SET active = true, created_at = NOW();
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        INSERT INTO provider_departments_junction (provider_id, department_id, created_at, active)
        SELECT v_provider_id, did, NOW(), true
        FROM unnest(v_department_ids) AS did
        ON CONFLICT ON CONSTRAINT provider_departments_pkey DO UPDATE
        SET active = true, created_at = NOW();
    END IF;

    UPDATE providers_resource r
    SET
        name = n.name,
        description = d.description,
        value = v.value,
        endpoint = e.base_url,
        key = k.key,
        updated_at = NOW()
    FROM provider_providers_junction j
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    LEFT JOIN values_resource v ON v.id = v_value_id
    LEFT JOIN endpoints_resource e ON e.id = v_endpoint_id
    LEFT JOIN keys_resource k ON k.id = v_key_id
    WHERE j.providers_id = r.id
      AND j.provider_id = v_provider_id;

    INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (uuidv7(), 0, 0, 0, group_id, NOW(), NOW())
    RETURNING id INTO v_run_id;

    IF (names).create_tool_id IS NOT NULL THEN
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'provider_save_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
        INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).create_tool_id, v_call_id);
        INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
    END IF;

    IF (names).link_tool_id IS NOT NULL THEN
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'provider_save_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
        INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).link_tool_id, v_call_id);
        INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
    END IF;

    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT department_id, v_call_id FROM UNNEST(v_department_ids) AS department_id;
        END IF;

        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT department_id, v_call_id FROM UNNEST(v_department_ids) AS department_id;
        END IF;
    END IF;

    IF v_value_id IS NOT NULL THEN
        IF (values_action).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_create_values_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((values_action).create_tool_id, v_call_id);
            INSERT INTO values_calls_connection (values_id, call_id) VALUES (v_value_id, v_call_id);
        END IF;

        IF (values_action).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_link_values_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((values_action).link_tool_id, v_call_id);
            INSERT INTO values_calls_connection (values_id, call_id) VALUES (v_value_id, v_call_id);
        END IF;
    END IF;

    IF v_endpoint_id IS NOT NULL THEN
        IF (endpoints).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_create_endpoints_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((endpoints).create_tool_id, v_call_id);
            INSERT INTO endpoints_calls_connection (endpoints_id, call_id) VALUES (v_endpoint_id, v_call_id);
        END IF;

        IF (endpoints).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_link_endpoints_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((endpoints).link_tool_id, v_call_id);
            INSERT INTO endpoints_calls_connection (endpoints_id, call_id) VALUES (v_endpoint_id, v_call_id);
        END IF;
    END IF;

    IF v_key_id IS NOT NULL THEN
        IF (keys).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_create_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((keys).create_tool_id, v_call_id);
            INSERT INTO keys_calls_connection (keys_id, call_id) VALUES (v_key_id, v_call_id);
        END IF;

        IF (keys).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'provider_save_link_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((keys).link_tool_id, v_call_id);
            INSERT INTO keys_calls_connection (keys_id, call_id) VALUES (v_key_id, v_call_id);
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        v_provider_id AS provider_id;
END;
$$;

