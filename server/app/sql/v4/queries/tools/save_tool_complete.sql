-- Unified save tool function - handles both create (input_tool_id = NULL) and update (input_tool_id provided)
-- Accepts resource IDs directly (not raw strings) following persona gold standard
-- Permission checks are handled in Python (permissions.py)

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_tool_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_tool_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with resource ID parameters (no raw strings)
CREATE OR REPLACE FUNCTION api_save_tool_v4(
    profile_id uuid,
    group_id uuid,
    input_tool_id uuid DEFAULT NULL,
    -- Required single-select resources
    name_id uuid DEFAULT NULL,
    -- Optional single-select resources
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    -- Optional multi-select resources
    args_ids uuid[] DEFAULT NULL,
    args_outputs_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    tool_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_tool_id uuid;
    v_actor_name text;
    v_group_id uuid;
    v_profile_id uuid;
    v_input_tool_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_args_ids uuid[];
    v_args_outputs_ids uuid[];
BEGIN
    -- Assign parameters to local variables
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_tool_id := input_tool_id;
    v_name_id := name_id;
    v_description_id := description_id;
    v_active_flag_id := active_flag_id;
    v_args_ids := COALESCE(args_ids, ARRAY[]::uuid[]);
    v_args_outputs_ids := COALESCE(args_outputs_ids, ARRAY[]::uuid[]);

    -- Validate required fields
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    -- Determine if create or update
    is_create := (v_input_tool_id IS NULL);

    -- Create or UPDATE tool_artifact first
    IF is_create THEN
        -- CREATE path
        INSERT INTO tool_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_tool_id;
    ELSE
        -- UPDATE path
        v_tool_id := v_input_tool_id;
        UPDATE tool_artifact
        SET updated_at = NOW()
        WHERE id = v_tool_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Tool not found: %', v_input_tool_id;
        END IF;

    END IF;

    -- Validate resource IDs exist
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    -- Validate args IDs exist
    IF COALESCE(array_length(v_args_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_args_ids) AS args_id
            WHERE NOT EXISTS (SELECT 1 FROM args_resource WHERE id = args_id)
        ) THEN
            RAISE EXCEPTION 'One or more args resources not found';
        END IF;
    END IF;

    -- Validate args_outputs IDs exist
    IF COALESCE(array_length(v_args_outputs_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_args_outputs_ids) AS args_outputs_id
            WHERE NOT EXISTS (SELECT 1 FROM args_outputs_resource WHERE id = args_outputs_id)
        ) THEN
            RAISE EXCEPTION 'One or more args_outputs resources not found';
        END IF;
    END IF;

    -- Conditional: For update, remove old links first
    IF NOT is_create THEN
        DELETE FROM tool_names_junction WHERE tool_id = v_tool_id;
        DELETE FROM tool_descriptions_junction WHERE tool_id = v_tool_id;
        DELETE FROM tool_args_junction WHERE tool_id = v_tool_id;
        DELETE FROM tool_args_outputs_junction WHERE tool_id = v_tool_id;
        -- Update existing active flag if it exists
        UPDATE tool_flags_junction SET
            flag_id = COALESCE(v_active_flag_id, tool_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE tool_id = v_tool_id;
    END IF;

    -- Continue with tool save using SQL (tool already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_tool_id AS tool_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_args_ids AS args_ids,
            v_args_outputs_ids AS args_outputs_ids,
            v_profile_id AS profile_id
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Permission validation is now handled in Python (permissions.py)
    actor_profile AS (
        SELECT
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link tool to name
    link_tool_name AS (
        INSERT INTO tool_names_junction (tool_id, name_id, created_at, generated, mcp)
        SELECT
            x.tool_id,
            x.name_id,
            NOW(),
            false,
            false
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT tool_names_pkey DO NOTHING
    ),
    -- Link tool to description
    link_tool_description AS (
        INSERT INTO tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp)
        SELECT
            x.tool_id,
            x.description_id,
            NOW(),
            false,
            false
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT tool_descriptions_pkey DO NOTHING
    ),
    -- Insert or UPDATE tool_artifact active flag
    insert_tool_active_flag AS (
        INSERT INTO tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp)
        SELECT x.tool_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'tool_active'
        ON CONFLICT ON CONSTRAINT tool_flags_pkey DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, tool_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Link tool to args (old ones already deleted above if update)
    link_args AS (
        INSERT INTO tool_args_junction (tool_id, args_id, created_at, generated, mcp)
        SELECT
            x.tool_id,
            args_id,
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN UNNEST(x.args_ids) as args_id
        WHERE COALESCE(array_length(x.args_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT tool_args_pkey DO NOTHING
    ),
    -- Link tool to args_outputs (old ones already deleted above if update)
    link_args_outputs AS (
        INSERT INTO tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp)
        SELECT
            x.tool_id,
            args_outputs_id,
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN UNNEST(x.args_outputs_ids) as args_outputs_id
        WHERE COALESCE(array_length(x.args_outputs_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT tool_args_outputs_pkey DO NOTHING
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE tools_resource r
        SET name = n.name,
            description = d.description
        FROM tool_tools_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.tools_id = r.id
          AND j.tool_id = p.tool_id
        RETURNING r.id
    )
    SELECT
        x.tool_id AS tool_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
