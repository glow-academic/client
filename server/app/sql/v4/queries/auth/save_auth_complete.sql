-- Save auth with nested resource actions and tool-call tracking.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.auth_resource_action CASCADE;
    CREATE TYPE types.auth_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.auth_multi_resource_action CASCADE;
    CREATE TYPE types.auth_multi_resource_action AS (
        resource_ids uuid[],
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.auth_item_input CASCADE;
    CREATE TYPE types.auth_item_input AS (
        name text,
        description text,
        encrypted boolean,
        position integer,
        active boolean,
        key_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.auth_item_action CASCADE;
    CREATE TYPE types.auth_item_action AS (
        items types.auth_item_input[],
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
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_save_auth_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_auth_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_auth_v4(
    profile_id uuid,
    group_id uuid,
    input_auth_id uuid DEFAULT NULL,
    names types.auth_resource_action DEFAULT NULL,
    descriptions types.auth_resource_action DEFAULT NULL,
    flags types.auth_resource_action DEFAULT NULL,
    protocols types.auth_multi_resource_action DEFAULT NULL,
    slugs types.auth_multi_resource_action DEFAULT NULL,
    items types.auth_item_action DEFAULT NULL
)
RETURNS TABLE (
    auth_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_auth_id uuid;
    is_create boolean := (input_auth_id IS NULL);

    v_name_id uuid := (names).resource_id;
    v_description_id uuid := (descriptions).resource_id;
    v_active_flag_id uuid := (flags).resource_id;
    v_protocol_ids uuid[] := COALESCE((protocols).resource_ids, ARRAY[]::uuid[]);
    v_slug_ids uuid[] := COALESCE((slugs).resource_ids, ARRAY[]::uuid[]);
    v_items types.auth_item_input[] := COALESCE((items).items, ARRAY[]::types.auth_item_input[]);

    v_run_id uuid;
    v_call_id uuid;
    v_default_auth_active_flag_id uuid;
BEGIN
    IF group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    SELECT id INTO v_default_auth_active_flag_id
    FROM flags_resource
    WHERE name = 'auth_active'
    LIMIT 1;

    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF v_protocol_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(v_protocol_ids) AS protocol_id
        WHERE NOT EXISTS (SELECT 1 FROM protocols_resource WHERE id = protocol_id)
    ) THEN
        RAISE EXCEPTION 'One or more protocol resources not found';
    END IF;

    IF v_slug_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(v_slug_ids) AS slug_id
        WHERE NOT EXISTS (SELECT 1 FROM slugs_resource WHERE id = slug_id)
    ) THEN
        RAISE EXCEPTION 'One or more slug resources not found';
    END IF;

    IF is_create THEN
        INSERT INTO auths_resource (id, group_id)
        VALUES (uuidv7(), group_id)
        RETURNING id INTO v_auth_id;
    ELSE
        v_auth_id := input_auth_id;

        UPDATE auths_resource
        SET group_id = api_save_auth_v4.group_id
        WHERE id = v_auth_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Auth not found: %', input_auth_id;
        END IF;
    END IF;

    UPDATE auth_names_junction SET active = false WHERE auth_id = v_auth_id AND active = true;
    UPDATE auth_descriptions_junction SET active = false WHERE auth_id = v_auth_id AND active = true;
    UPDATE auth_flags_junction SET active = false WHERE auth_id = v_auth_id AND active = true;
    UPDATE auth_protocols_junction SET active = false WHERE auth_id = v_auth_id AND active = true;
    UPDATE auth_slugs_junction SET active = false WHERE auth_id = v_auth_id AND active = true;
    UPDATE auth_items_junction SET active = false WHERE auth_id = v_auth_id AND active = true;

    INSERT INTO auth_names_junction (auth_id, name_id, created_at, active)
    VALUES (v_auth_id, v_name_id, NOW(), true)
    ON CONFLICT ON CONSTRAINT auth_names_pkey DO UPDATE
    SET active = true, created_at = NOW();

    IF v_description_id IS NOT NULL THEN
        INSERT INTO auth_descriptions_junction (auth_id, description_id, created_at, active)
        VALUES (v_auth_id, v_description_id, NOW(), true)
        ON CONFLICT ON CONSTRAINT auth_descriptions_pkey DO UPDATE
        SET active = true, created_at = NOW();
    END IF;

    INSERT INTO auth_flags_junction (auth_id, flag_id, value, created_at, active)
    VALUES (
        v_auth_id,
        COALESCE(v_active_flag_id, v_default_auth_active_flag_id),
        CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END,
        NOW(),
        true
    )
    ON CONFLICT ON CONSTRAINT auth_flags_pkey DO UPDATE
    SET flag_id = EXCLUDED.flag_id,
        value = EXCLUDED.value,
        active = true,
        created_at = NOW();

    IF COALESCE(array_length(v_protocol_ids, 1), 0) > 0 THEN
        INSERT INTO auth_protocols_junction (auth_id, protocol_id, created_at, active)
        SELECT v_auth_id, protocol_id, NOW(), true
        FROM unnest(v_protocol_ids) AS protocol_id
        ON CONFLICT ON CONSTRAINT auth_protocols_pkey DO UPDATE
        SET active = true, created_at = NOW();
    END IF;

    IF COALESCE(array_length(v_slug_ids, 1), 0) > 0 THEN
        INSERT INTO auth_slugs_junction (auth_id, slug_id, created_at, active)
        SELECT v_auth_id, slug_id, NOW(), true
        FROM unnest(v_slug_ids) AS slug_id
        ON CONFLICT ON CONSTRAINT auth_slugs_pkey DO UPDATE
        SET active = true, created_at = NOW();
    END IF;

    IF COALESCE(array_length(v_items, 1), 0) > 0 THEN
        WITH items_expanded AS (
            SELECT
                row_number() OVER () AS item_idx,
                item.name AS item_name,
                item.description AS item_description,
                COALESCE(item.encrypted, true) AS item_encrypted,
                COALESCE(item.position, row_number() OVER ()) AS item_position,
                COALESCE(item.active, true) AS item_active
            FROM unnest(v_items) AS item
        ),
        created_items AS (
            INSERT INTO items_resource (
                name,
                description,
                encrypted,
                position,
                active,
                created_at
            )
            SELECT
                ie.item_name,
                ie.item_description,
                ie.item_encrypted,
                ie.item_position,
                ie.item_active,
                NOW()
            FROM items_expanded ie
            RETURNING id
        ),
        indexed_items AS (
            SELECT row_number() OVER (ORDER BY id) AS item_idx, id
            FROM created_items
        )
        INSERT INTO auth_items_junction (auth_id, item_id, created_at, active)
        SELECT v_auth_id, ii.id, NOW(), true
        FROM indexed_items ii
        ON CONFLICT ON CONSTRAINT auth_items_pkey DO UPDATE
        SET active = true, created_at = NOW();
    END IF;

    UPDATE auths_resource r
    SET name = n.name,
        description = d.description
    FROM auth_auths_junction j
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    WHERE j.auths_id = r.id
      AND j.auth_id = v_auth_id;

    INSERT INTO runs_entry (id, group_id, created_at, updated_at)
    VALUES (uuidv7(), 0, 0, 0, group_id, NOW(), NOW())
    RETURNING id INTO v_run_id;

    IF v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_create_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_link_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_create_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_link_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_create_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_link_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    IF COALESCE(array_length(v_protocol_ids, 1), 0) > 0 THEN
        IF (protocols).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_create_protocols_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((protocols).create_tool_id, v_call_id);
            INSERT INTO protocols_calls_connection (protocols_id, call_id)
            SELECT protocol_id, v_call_id FROM unnest(v_protocol_ids) AS protocol_id;
        END IF;
        IF (protocols).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_link_protocols_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((protocols).link_tool_id, v_call_id);
            INSERT INTO protocols_calls_connection (protocols_id, call_id)
            SELECT protocol_id, v_call_id FROM unnest(v_protocol_ids) AS protocol_id;
        END IF;
    END IF;

    IF COALESCE(array_length(v_slug_ids, 1), 0) > 0 THEN
        IF (slugs).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_create_slugs_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((slugs).create_tool_id, v_call_id);
            INSERT INTO slugs_calls_connection (slugs_id, call_id)
            SELECT slug_id, v_call_id FROM unnest(v_slug_ids) AS slug_id;
        END IF;
        IF (slugs).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_link_slugs_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((slugs).link_tool_id, v_call_id);
            INSERT INTO slugs_calls_connection (slugs_id, call_id)
            SELECT slug_id, v_call_id FROM unnest(v_slug_ids) AS slug_id;
        END IF;
    END IF;

    IF COALESCE(array_length(v_items, 1), 0) > 0 THEN
        IF (items).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_create_items_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((items).create_tool_id, v_call_id);
            INSERT INTO items_calls_connection (items_id, call_id)
            SELECT aij.item_id, v_call_id
            FROM auth_items_junction aij
            WHERE aij.auth_id = v_auth_id AND aij.active = true;
        END IF;
        IF (items).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'auth_save_link_items_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((items).link_tool_id, v_call_id);
            INSERT INTO items_calls_connection (items_id, call_id)
            SELECT aij.item_id, v_call_id
            FROM auth_items_junction aij
            WHERE aij.auth_id = v_auth_id AND aij.active = true;
        END IF;
    END IF;

    RETURN QUERY
    SELECT v_auth_id;
END;
$$;

