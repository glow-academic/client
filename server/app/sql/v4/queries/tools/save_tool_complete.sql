-- Unified save tool function - handles both create (tool_id = NULL) and update (tool_id provided)
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
        WHERE proname = 'api_save_tool_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_tool_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_tool_v4(
    name text,
    description text,
    profile_id uuid,
    args_ids uuid[] DEFAULT NULL,
    args_outputs_ids uuid[] DEFAULT NULL,
    input_tool_id uuid DEFAULT NULL,
    active boolean DEFAULT true
)
RETURNS TABLE (
    tool_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_tool_id uuid;
    v_actor_name text;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
BEGIN
    -- Determine if create or update
    is_create := (input_tool_id IS NULL);
    
    -- Create or UPDATE tool_artifact first (without name, description, active - these go in junction tables)
    IF is_create THEN
        -- CREATE path
        INSERT INTO tool_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_tool_id;
    ELSE
        -- UPDATE path
        v_tool_id := input_tool_id;
        UPDATE tool_artifact
        SET updated_at = NOW()
        WHERE id = v_tool_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Tool not found: %', input_tool_id;
        END IF;
    END IF;

    -- Handle name (insert/update via tool_names_junction junction)
    IF name IS NOT NULL AND name != '' THEN
        INSERT INTO names_resource (name, created_at, active, generated, mcp, call_id)
        VALUES (name, NOW(), true, false, false, NULL)
        ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id INTO v_name_id;
        
        -- Delete existing name links and insert new one
        DELETE FROM tool_names_junction WHERE tool_id = v_tool_id;
        INSERT INTO tool_names_junction (tool_id, name_id, created_at, generated, mcp)
        VALUES (v_tool_id, v_name_id, NOW(), false, false);
    END IF;

    -- Handle description (insert/update via tool_descriptions_junction junction)
    IF description IS NOT NULL AND description != '' THEN
        INSERT INTO descriptions_resource (description, created_at, active, generated, mcp, call_id)
        VALUES (description, NOW(), true, false, false, NULL)
        ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id INTO v_description_id;
        
        -- Delete existing description links and insert new one
        DELETE FROM tool_descriptions_junction WHERE tool_id = v_tool_id;
        INSERT INTO tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp)
        VALUES (v_tool_id, v_description_id, NOW(), false, false);
    END IF;

    -- Handle active flag (insert/update via tool_flags_junction junction)
    IF active IS NOT NULL THEN
        INSERT INTO tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp) SELECT v_tool_id,
            f.id,
            active,
            NOW(),
            false,
            false
        FROM flags_resource f
        WHERE f.name = 'tool_active'
        ON CONFLICT (tool_id, flag_id, type) DO UPDATE SET value = EXCLUDED.value;
    END IF;
    
    -- Validate args IDs exist
    IF args_ids IS NOT NULL AND COALESCE(array_length(args_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(args_ids) AS args_id
            WHERE NOT EXISTS (SELECT 1 FROM args_resource WHERE id = args_id)
        ) THEN
            RAISE EXCEPTION 'One or more args resources not found';
        END IF;
    END IF;
    
    -- Validate args_outputs IDs exist
    IF args_outputs_ids IS NOT NULL AND COALESCE(array_length(args_outputs_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(args_outputs_ids) AS args_outputs_id
            WHERE NOT EXISTS (SELECT 1 FROM args_outputs_resource WHERE id = args_outputs_id)
        ) THEN
            RAISE EXCEPTION 'One or more args_outputs resources not found';
        END IF;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM tool_args_junction WHERE tool_id = v_tool_id;
        DELETE FROM tool_args_outputs_junction WHERE tool_id = v_tool_id;
    END IF;
    
    -- Continue with tool save using SQL (tool already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_tool_id AS tool_id,
            COALESCE(args_ids, ARRAY[]::uuid[]) AS args_ids,
            COALESCE(args_outputs_ids, ARRAY[]::uuid[]) AS args_outputs_ids,
            profile_id
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
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
    )
    SELECT 
        x.tool_id AS tool_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
