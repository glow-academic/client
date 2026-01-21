-- Unified save auth function - handles both create (auth_id = NULL) and update (auth_id provided)
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
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
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
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
    key_id uuid  -- NULL allowed by default in PostgreSQL
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_save_auth_v4(
    draft_id uuid,
    profile_id uuid,
    input_auth_id uuid DEFAULT NULL
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
    v_group_id uuid;
    v_draft_id uuid;
    v_profile_id uuid;
    v_input_auth_id uuid;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_protocol_ids uuid[];
    v_slug_ids uuid[];
    v_auth_items types.i_save_auth_v4_auth_item[];
BEGIN
    v_draft_id := draft_id;
    v_profile_id := profile_id;
    v_input_auth_id := input_auth_id;

    IF v_draft_id IS NULL THEN
        RAISE EXCEPTION 'Draft ID is required';
    END IF;

    SELECT d.group_id INTO v_group_id
    FROM drafts d
    WHERE d.id = v_draft_id;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Draft group_id not found: %', v_draft_id;
    END IF;

    SELECT dn.names_id INTO v_name_id
    FROM draft_names dn
    WHERE dn.draft_id = v_draft_id
    LIMIT 1;

    SELECT dd.descriptions_id INTO v_description_id
    FROM draft_descriptions dd
    WHERE dd.draft_id = v_draft_id
    LIMIT 1;

    SELECT df.flags_id INTO v_active_flag_id
    FROM draft_flags df
    WHERE df.draft_id = v_draft_id
    LIMIT 1;

    SELECT COALESCE(ARRAY_AGG(dp.protocols_id ORDER BY dp.created_at), ARRAY[]::uuid[])
    INTO v_protocol_ids
    FROM draft_protocols dp
    WHERE dp.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(ds.slugs_id ORDER BY ds.created_at), ARRAY[]::uuid[])
    INTO v_slug_ids
    FROM draft_slugs ds
    WHERE ds.draft_id = v_draft_id;

    SELECT COALESCE(
        ARRAY_AGG(
            (dai.name, dai.description, dai.encrypted, dai.position, dai.active, dai.key_id)::types.i_save_auth_v4_auth_item
            ORDER BY dai.position
        ),
        ARRAY[]::types.i_save_auth_v4_auth_item[]
    )
    INTO v_auth_items
    FROM draft_auth_items dai
    WHERE dai.draft_id = v_draft_id;

    -- Determine if create or update
    is_create := (v_input_auth_id IS NULL);
    
    -- Create or UPDATE auth_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO auths_resource (id, group_id)
        VALUES (uuidv7(), v_group_id)
        RETURNING id INTO v_auth_id;
    ELSE
        -- UPDATE path
        v_auth_id := v_input_auth_id;
        UPDATE auths_resource
        SET updated_at = NOW(),
            group_id = v_group_id
        WHERE id = v_auth_id;
    END IF;
    
    -- Validate required resource IDs exist (same for both)
    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
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
    
    -- Validate protocol_ids exist
    IF COALESCE(array_length(v_protocol_ids, 1), 0) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM protocols_resource WHERE id = ANY(v_protocol_ids)) THEN
            RAISE EXCEPTION 'One or more protocol resources not found';
        END IF;
    END IF;
    
    -- Validate slug_ids exist
    IF COALESCE(array_length(v_slug_ids, 1), 0) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM slugs_resource WHERE id = ANY(v_slug_ids)) THEN
            RAISE EXCEPTION 'One or more slug resources not found';
        END IF;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM auth_names WHERE auth_id = v_auth_id;
        DELETE FROM auth_descriptions WHERE auth_id = v_auth_id;
        DELETE FROM auth_protocols WHERE auth_id = v_auth_id;
        DELETE FROM auth_slugs WHERE auth_id = v_auth_id;
        DELETE FROM auth_items WHERE auth_id = v_auth_id;
        -- Update existing active flag if it exists
        UPDATE auth_flags SET
            flag_id = COALESCE(v_active_flag_id, auth_flags.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE auth_id = v_auth_id
          ;
    END IF;
    
    -- Continue with auth save using SQL (auth already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_auth_id AS auth_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            COALESCE(v_protocol_ids, ARRAY[]::uuid[]) AS protocol_ids,
            COALESCE(v_slug_ids, ARRAY[]::uuid[]) AS slug_ids,
            COALESCE(v_auth_items, ARRAY[]::types.i_save_auth_v4_auth_item[]) AS auth_items,
            v_profile_id AS profile_id
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j 
             JOIN roles_resource r ON pr_j.role_id = r.id 
             WHERE pr_j.profile_id = p.id 
             LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link auth to name
    link_auth_name AS (
        INSERT INTO auth_names (auth_id, name_id, created_at, updated_at)
        SELECT 
            x.auth_id,
            x.name_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT auth_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link auth to description
    link_auth_description AS (
        INSERT INTO auth_descriptions (auth_id, description_id, created_at, updated_at)
        SELECT 
            x.auth_id,
            x.description_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT auth_descriptions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Insert or UPDATE auth_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_auth_active_flag AS (
        INSERT INTO auth_flags (auth_id, flag_id, value, created_at, updated_at) SELECT x.auth_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'active'
        ON CONFLICT ON CONSTRAINT auth_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, auth_flags.flag_id),
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Link protocols (old ones already deleted above if update)
    link_protocols AS (
        INSERT INTO auth_protocols (auth_id, protocol_id, created_at, updated_at)
        SELECT 
            x.auth_id,
            protocol_id,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.protocol_ids) as protocol_id
        WHERE COALESCE(array_length(x.protocol_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT auth_protocols_pkey DO UPDATE SET
            updated_at = NOW()
    ),
    -- Link slugs (old ones already deleted above if update)
    link_slugs AS (
        INSERT INTO auth_slugs (auth_id, slug_id, created_at, updated_at)
        SELECT 
            x.auth_id,
            slug_id,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.slug_ids) as slug_id
        WHERE COALESCE(array_length(x.slug_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT auth_slugs_pkey DO UPDATE SET
            updated_at = NOW()
    ),
    -- Handle auth_items (special handling - not a standard resource)
    items_expanded AS (
        -- Expand composite type array with row numbers for matching
        SELECT 
            row_number() OVER () as item_idx,
            item.name as item_name,
            item.description as item_description,
            COALESCE(item.encrypted, true) as item_encrypted,
            COALESCE(item.position, row_number() OVER ()) as item_position,
            COALESCE(item.active, true) as item_active,
            item.key_id as item_key_id
        FROM params x
        CROSS JOIN LATERAL unnest(x.auth_items) AS item
    ),
    new_items AS (
        -- Create all items (standalone table) - one per auth item
        INSERT INTO items_resource (
            name,
            description,
            encrypted,
            position,
            active,
            created_at,
            updated_at
        )
        SELECT 
            ie.item_name,
            ie.item_description,
            ie.item_encrypted,
            ie.item_position,
            ie.item_active,
            NOW(),
            NOW()
        FROM items_expanded ie
        RETURNING id as item_id
    ),
    items_with_idx AS (
        -- Match created items back to their expanded data using row numbers
        SELECT 
            ROW_NUMBER() OVER (ORDER BY ni.item_id) as item_idx,
            ni.item_id
        FROM new_items ni
    ),
    -- Link auth to items via junction table
    link_auth_items AS (
        INSERT INTO auth_items (auth_id, item_id, created_at, updated_at)
        SELECT 
            x.auth_id,
            iwi.item_id,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN items_expanded ie
        JOIN items_with_idx iwi ON iwi.item_idx = ie.item_idx
        WHERE COALESCE(array_length(x.auth_items, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT auth_items_pkey DO UPDATE SET updated_at = NOW()
    )
    SELECT 
        x.auth_id AS auth_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
