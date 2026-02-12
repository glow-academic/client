-- Patch auth draft with nested resource actions and tool-call tracking.

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
        WHERE proname = 'api_patch_auth_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_auth_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_auth_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.auth_resource_action DEFAULT NULL,
    descriptions types.auth_resource_action DEFAULT NULL,
    flags types.auth_resource_action DEFAULT NULL,
    protocols types.auth_multi_resource_action DEFAULT NULL,
    slugs types.auth_multi_resource_action DEFAULT NULL,
    items types.auth_item_action DEFAULT NULL,
    expected_version int DEFAULT 0
)
RETURNS TABLE (
    draft_id uuid,
    new_version int,
    draft_exists boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_draft_id uuid;
    v_new_version int;
    v_draft_exists boolean := false;

    v_profile_id uuid := profile_id;
    v_group_id uuid := group_id;

    v_name_id uuid := (names).resource_id;
    v_description_id uuid := (descriptions).resource_id;
    v_active_flag_id uuid := (flags).resource_id;
    v_protocol_ids uuid[] := COALESCE((protocols).resource_ids, ARRAY[]::uuid[]);
    v_slug_ids uuid[] := COALESCE((slugs).resource_ids, ARRAY[]::uuid[]);
    v_items types.auth_item_input[] := COALESCE((items).items, ARRAY[]::types.auth_item_input[]);

    v_run_id uuid;
    v_call_id uuid;
BEGIN
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

    IF input_draft_id IS NOT NULL THEN
        IF v_group_id IS NULL THEN
            SELECT view_drafts_entry.group_id INTO v_group_id
            FROM view_drafts_entry
            WHERE view_drafts_entry.id = input_draft_id;
        END IF;

        UPDATE drafts_entry
        SET version = drafts_entry.version + 1,
            updated_at = NOW(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE drafts_entry.id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM profiles_drafts_connection pdc
              WHERE pdc.draft_id = drafts_entry.id
                AND pdc.profiles_id = v_profile_id
          )
          AND drafts_entry.version = expected_version
        RETURNING drafts_entry.id, drafts_entry.version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    IF v_draft_id IS NULL THEN
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (
                    SELECT id
                    FROM view_sessions_entry
                    WHERE view_sessions_entry.profile_id = v_profile_id
                      AND view_sessions_entry.active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO drafts_entry (artifact, group_id)
        VALUES ('auth'::artifact_type, v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profile_id, v_new_version);
    END IF;

    DELETE FROM names_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM descriptions_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM flags_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM protocols_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM slugs_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM items_drafts_connection WHERE draft_id = v_draft_id;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO names_drafts_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO descriptions_drafts_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO flags_drafts_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_protocol_ids, 1), 0) > 0 THEN
        INSERT INTO protocols_drafts_connection (draft_id, protocols_id, version)
        SELECT v_draft_id, protocol_id, v_new_version
        FROM unnest(v_protocol_ids) AS protocol_id
        ON CONFLICT ON CONSTRAINT protocols_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_slug_ids, 1), 0) > 0 THEN
        INSERT INTO slugs_drafts_connection (draft_id, slugs_id, version)
        SELECT v_draft_id, slug_id, v_new_version
        FROM unnest(v_slug_ids) AS slug_id
        ON CONFLICT ON CONSTRAINT slugs_draft_pkey DO UPDATE
        SET version = v_new_version;
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
        INSERT INTO items_drafts_connection (draft_id, items_id, version, created_at, active)
        SELECT v_draft_id, ii.id, v_new_version, NOW(), true
        FROM indexed_items ii
        ON CONFLICT ON CONSTRAINT items_draft_pkey DO UPDATE
        SET version = v_new_version,
            created_at = NOW(),
            active = true;
    END IF;

    INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (uuidv7(), 0, 0, 0, v_group_id, NOW(), NOW())
    RETURNING id INTO v_run_id;

    IF v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    IF COALESCE(array_length(v_protocol_ids, 1), 0) > 0 THEN
        IF (protocols).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_create_protocols_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((protocols).create_tool_id, v_call_id);
            INSERT INTO protocols_calls_connection (protocols_id, call_id)
            SELECT protocol_id, v_call_id FROM unnest(v_protocol_ids) AS protocol_id;
        END IF;
        IF (protocols).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_link_protocols_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((protocols).link_tool_id, v_call_id);
            INSERT INTO protocols_calls_connection (protocols_id, call_id)
            SELECT protocol_id, v_call_id FROM unnest(v_protocol_ids) AS protocol_id;
        END IF;
    END IF;

    IF COALESCE(array_length(v_slug_ids, 1), 0) > 0 THEN
        IF (slugs).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_create_slugs_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((slugs).create_tool_id, v_call_id);
            INSERT INTO slugs_calls_connection (slugs_id, call_id)
            SELECT slug_id, v_call_id FROM unnest(v_slug_ids) AS slug_id;
        END IF;
        IF (slugs).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_link_slugs_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((slugs).link_tool_id, v_call_id);
            INSERT INTO slugs_calls_connection (slugs_id, call_id)
            SELECT slug_id, v_call_id FROM unnest(v_slug_ids) AS slug_id;
        END IF;
    END IF;

    IF COALESCE(array_length(v_items, 1), 0) > 0 THEN
        IF (items).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_create_items_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((items).create_tool_id, v_call_id);
            INSERT INTO items_calls_connection (items_id, call_id)
            SELECT idc.items_id, v_call_id
            FROM items_drafts_connection idc
            WHERE idc.draft_id = v_draft_id;
        END IF;
        IF (items).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'auth_draft_link_items_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((items).link_tool_id, v_call_id);
            INSERT INTO items_calls_connection (items_id, call_id)
            SELECT idc.items_id, v_call_id
            FROM items_drafts_connection idc
            WHERE idc.draft_id = v_draft_id;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
