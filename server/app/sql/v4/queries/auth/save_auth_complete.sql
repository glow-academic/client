-- Unified save auth function - handles both create (auth_id = NULL) and update (auth_id provided)
-- Accepts field IDs directly (no draft reading) - persona gold standard pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_auth_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_auth_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'i_save_auth_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_save_auth_v4_auth_item AS (
    name text,
    description text,
    encrypted boolean,
    position integer,
    active boolean,
    key_id uuid
);

-- 4) Recreate function - now accepts field IDs directly
CREATE OR REPLACE FUNCTION api_save_auth_v4(
    profile_id uuid,
    group_id uuid,
    input_auth_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    protocol_ids uuid[] DEFAULT ARRAY[]::uuid[],
    slug_ids uuid[] DEFAULT ARRAY[]::uuid[],
    auth_items_junction types.i_save_auth_v4_auth_item[] DEFAULT ARRAY[]::types.i_save_auth_v4_auth_item[]
)
RETURNS TABLE (
    auth_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_auth_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Validate required fields
    IF name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    IF group_id IS NULL THEN
        RAISE EXCEPTION 'Group ID is required';
    END IF;

    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;

    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;

    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;

    -- Validate protocol_ids exist
    IF COALESCE(array_length(protocol_ids, 1), 0) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM protocols_resource WHERE id = ANY(protocol_ids)) THEN
            RAISE EXCEPTION 'One or more protocol resources not found';
        END IF;
    END IF;

    -- Validate slug_ids exist
    IF COALESCE(array_length(slug_ids, 1), 0) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM slugs_resource WHERE id = ANY(slug_ids)) THEN
            RAISE EXCEPTION 'One or more slug resources not found';
        END IF;
    END IF;

    -- Determine if create or update
    is_create := (input_auth_id IS NULL);

    -- Create or UPDATE
    IF is_create THEN
        INSERT INTO auths_resource (id)
        VALUES (uuidv7(), group_id)
        RETURNING id INTO v_auth_id;
    ELSE
        v_auth_id := input_auth_id;
        UPDATE auths_resource
        SET group_id = api_save_auth_v4.group_id
        WHERE id = v_auth_id;
    END IF;

    -- For update, remove old links first
    IF NOT is_create THEN
        DELETE FROM auth_names_junction WHERE auth_names_junction.auth_id = v_auth_id;
        DELETE FROM auth_descriptions_junction WHERE auth_descriptions_junction.auth_id = v_auth_id;
        DELETE FROM auth_protocols_junction WHERE auth_protocols_junction.auth_id = v_auth_id;
        DELETE FROM auth_slugs_junction WHERE auth_slugs_junction.auth_id = v_auth_id;
        DELETE FROM auth_items_junction WHERE auth_items_junction.auth_id = v_auth_id;
        -- Update existing active flag if it exists
        UPDATE auth_flags_junction SET
            flag_id = COALESCE(api_save_auth_v4.active_flag_id, auth_flags_junction.flag_id),
            value = CASE WHEN api_save_auth_v4.active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE auth_flags_junction.auth_id = v_auth_id;
    END IF;

    -- Continue with auth save using SQL
    RETURN QUERY
    WITH params AS (
        SELECT
            v_auth_id AS p_auth_id,
            api_save_auth_v4.name_id AS p_name_id,
            api_save_auth_v4.description_id AS p_description_id,
            api_save_auth_v4.active_flag_id AS p_active_flag_id,
            COALESCE(api_save_auth_v4.protocol_ids, ARRAY[]::uuid[]) AS p_protocol_ids,
            COALESCE(api_save_auth_v4.slug_ids, ARRAY[]::uuid[]) AS p_slug_ids,
            api_save_auth_v4.auth_items_junction AS p_auth_items_junction,
            api_save_auth_v4.profile_id AS p_profile_id
    ),
    user_profile AS (
        SELECT role, view_user_profile_context.actor_name
        FROM view_user_profile_context
        WHERE view_user_profile_context.profile_id = (SELECT p_profile_id FROM params)
    ),
    actor_profile AS (
        SELECT
            x.p_profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link auth to name
    link_auth_name AS (
        INSERT INTO auth_names_junction (auth_id, name_id, created_at)
        SELECT
            x.p_auth_id,
            x.p_name_id,
            NOW()
        FROM params x
        WHERE x.p_name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT auth_names_pkey DO NOTHING
    ),
    -- Link auth to description
    link_auth_description AS (
        INSERT INTO auth_descriptions_junction (auth_id, description_id, created_at)
        SELECT
            x.p_auth_id,
            x.p_description_id,
            NOW()
        FROM params x
        WHERE x.p_description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT auth_descriptions_pkey DO NOTHING
    ),
    -- Insert or UPDATE auth active flag
    insert_auth_active_flag AS (
        INSERT INTO auth_flags_junction (auth_id, flag_id, value, created_at)
        SELECT x.p_auth_id,
            COALESCE(x.p_active_flag_id, f.id),
            CASE WHEN x.p_active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'auth_active'
        ON CONFLICT ON CONSTRAINT auth_flags_pkey DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, auth_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Link protocols
    link_protocols AS (
        INSERT INTO auth_protocols_junction (auth_id, protocol_id, created_at)
        SELECT
            x.p_auth_id,
            protocol_id,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.p_protocol_ids) as protocol_id
        WHERE COALESCE(array_length(x.p_protocol_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT auth_protocols_pkey DO NOTHING
    ),
    -- Link slugs
    link_slugs AS (
        INSERT INTO auth_slugs_junction (auth_id, slug_id, created_at)
        SELECT
            x.p_auth_id,
            slug_id,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.p_slug_ids) as slug_id
        WHERE COALESCE(array_length(x.p_slug_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT auth_slugs_pkey DO NOTHING
    ),
    -- Handle auth_items_junction (special handling - not a standard resource)
    items_expanded AS (
        SELECT
            row_number() OVER () as item_idx,
            item.name as item_name,
            item.description as item_description,
            COALESCE(item.encrypted, true) as item_encrypted,
            COALESCE(item.position, row_number() OVER ()) as item_position,
            COALESCE(item.active, true) as item_active,
            item.key_id as item_key_id
        FROM params x
        CROSS JOIN LATERAL unnest(x.p_auth_items_junction) AS item
    ),
    new_items AS (
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
        RETURNING id as item_id
    ),
    items_with_idx AS (
        SELECT
            ROW_NUMBER() OVER (ORDER BY ni.item_id) as item_idx,
            ni.item_id
        FROM new_items ni
    ),
    -- Link auth to items via junction table
    link_auth_items AS (
        INSERT INTO auth_items_junction (auth_id, item_id, created_at)
        SELECT
            x.p_auth_id,
            iwi.item_id,
            NOW()
        FROM params x
        CROSS JOIN items_expanded ie
        JOIN items_with_idx iwi ON iwi.item_idx = ie.item_idx
        WHERE COALESCE(array_length(x.p_auth_items_junction, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT auth_items_pkey DO NOTHING
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE auths_resource r
        SET name = n.name,
            description = d.description
        FROM auth_auths_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.p_name_id
        LEFT JOIN descriptions_resource d ON d.id = p.p_description_id
        WHERE j.auths_id = r.id
          AND j.auth_id = p.p_auth_id
        RETURNING r.id
    )
    SELECT
        x.p_auth_id AS auth_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
