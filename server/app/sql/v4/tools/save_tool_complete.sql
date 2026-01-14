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
    schema_ids uuid[],
    template_ids uuid[],
    profile_id uuid,
    schema_field_item_ids uuid[] DEFAULT NULL,
    template_array_item_ids uuid[] DEFAULT NULL,
    template_value_ids uuid[] DEFAULT NULL,
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

    -- Handle name (insert/update via tool_names junction)
    IF name IS NOT NULL AND name != '' THEN
        INSERT INTO names_resource (name, created_at, updated_at, active, generated, mcp, call_id)
        VALUES (name, NOW(), NOW(), true, false, false, NULL)
        ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_name_id;
        
        -- Delete existing name links and insert new one
        DELETE FROM tool_names WHERE tool_id = v_tool_id;
        INSERT INTO tool_names (tool_id, name_id, created_at, updated_at, generated, mcp)
        VALUES (v_tool_id, v_name_id, NOW(), NOW(), false, false);
    END IF;

    -- Handle description (insert/update via tool_descriptions junction)
    IF description IS NOT NULL AND description != '' THEN
        INSERT INTO descriptions_resource (description, created_at, updated_at, active, generated, mcp, call_id)
        VALUES (description, NOW(), NOW(), true, false, false, NULL)
        ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_description_id;
        
        -- Delete existing description links and insert new one
        DELETE FROM tool_descriptions WHERE tool_id = v_tool_id;
        INSERT INTO tool_descriptions (tool_id, description_id, created_at, updated_at, generated, mcp)
        VALUES (v_tool_id, v_description_id, NOW(), NOW(), false, false);
    END IF;

    -- Handle active flag (insert/update via tool_flags junction)
    IF active IS NOT NULL THEN
        INSERT INTO tool_flags (tool_id, flag_id, type, value, created_at, updated_at, generated, mcp)
        SELECT 
            v_tool_id,
            f.id,
            'active'::type_tool_flags,
            active,
            NOW(),
            NOW(),
            false,
            false
        FROM flags_resource f
        WHERE f.name = 'active'
        ON CONFLICT (tool_id, flag_id, type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;
    
    -- Validate schema IDs exist
    IF COALESCE(array_length(schema_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(schema_ids) AS schema_id
            WHERE NOT EXISTS (SELECT 1 FROM schemas_resource WHERE id = schema_id)
        ) THEN
            RAISE EXCEPTION 'One or more schema resources not found';
        END IF;
    END IF;
    
    -- Validate template IDs exist
    IF COALESCE(array_length(template_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(template_ids) AS template_id
            WHERE NOT EXISTS (SELECT 1 FROM templates_resource WHERE id = template_id)
        ) THEN
            RAISE EXCEPTION 'One or more template resources not found';
        END IF;
    END IF;
    
    -- Validate schema_field_item IDs exist
    IF schema_field_item_ids IS NOT NULL AND COALESCE(array_length(schema_field_item_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(schema_field_item_ids) AS schema_field_item_id
            WHERE NOT EXISTS (SELECT 1 FROM schema_field_items_resource WHERE id = schema_field_item_id)
        ) THEN
            RAISE EXCEPTION 'One or more schema_field_item resources not found';
        END IF;
    END IF;
    
    -- Validate template_array_item IDs exist
    IF template_array_item_ids IS NOT NULL AND COALESCE(array_length(template_array_item_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(template_array_item_ids) AS template_array_item_id
            WHERE NOT EXISTS (SELECT 1 FROM template_array_items_resource WHERE id = template_array_item_id)
        ) THEN
            RAISE EXCEPTION 'One or more template_array_item resources not found';
        END IF;
    END IF;
    
    -- Validate template_value IDs exist
    IF template_value_ids IS NOT NULL AND COALESCE(array_length(template_value_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(template_value_ids) AS template_value_id
            WHERE NOT EXISTS (SELECT 1 FROM template_values_resource WHERE id = template_value_id)
        ) THEN
            RAISE EXCEPTION 'One or more template_value resources not found';
        END IF;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM tool_schemas WHERE tool_id = v_tool_id;
        DELETE FROM tool_templates WHERE tool_id = v_tool_id;
        DELETE FROM tool_schema_field_items WHERE tool_id = v_tool_id;
        DELETE FROM tool_template_array_items WHERE tool_id = v_tool_id;
        DELETE FROM tool_template_values WHERE tool_id = v_tool_id;
    END IF;
    
    -- Continue with tool save using SQL (tool already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_tool_id AS tool_id,
            COALESCE(schema_ids, ARRAY[]::uuid[]) AS schema_ids,
            COALESCE(template_ids, ARRAY[]::uuid[]) AS template_ids,
            COALESCE(schema_field_item_ids, ARRAY[]::uuid[]) AS schema_field_item_ids,
            COALESCE(template_array_item_ids, ARRAY[]::uuid[]) AS template_array_item_ids,
            COALESCE(template_value_ids, ARRAY[]::uuid[]) AS template_value_ids,
            profile_id
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
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
    -- Link tool to schemas (old ones already deleted above if update)
    link_schemas AS (
        INSERT INTO tool_schemas (tool_id, schema_id, created_at, updated_at, generated, mcp)
        SELECT 
            x.tool_id,
            schema_id,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN UNNEST(x.schema_ids) as schema_id
        WHERE COALESCE(array_length(x.schema_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT tool_schemas_pkey DO UPDATE SET
            updated_at = NOW()
    ),
    -- Link tool to templates (old ones already deleted above if update)
    link_templates AS (
        INSERT INTO tool_templates (tool_id, template_id, created_at, updated_at, generated, mcp)
        SELECT 
            x.tool_id,
            template_id,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN UNNEST(x.template_ids) as template_id
        WHERE COALESCE(array_length(x.template_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT tool_templates_pkey DO UPDATE SET
            updated_at = NOW()
    ),
    -- Link tool to schema_field_items (old ones already deleted above if update)
    link_schema_field_items AS (
        INSERT INTO tool_schema_field_items (tool_id, schema_field_item_id, created_at, updated_at, generated, mcp)
        SELECT 
            x.tool_id,
            schema_field_item_id,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN UNNEST(x.schema_field_item_ids) as schema_field_item_id
        WHERE COALESCE(array_length(x.schema_field_item_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT tool_schema_field_items_pkey DO UPDATE SET
            updated_at = NOW()
    ),
    -- Link tool to template_array_items (old ones already deleted above if update)
    link_template_array_items AS (
        INSERT INTO tool_template_array_items (tool_id, template_array_item_id, created_at, updated_at, generated, mcp)
        SELECT 
            x.tool_id,
            template_array_item_id,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN UNNEST(x.template_array_item_ids) as template_array_item_id
        WHERE COALESCE(array_length(x.template_array_item_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT tool_template_array_items_pkey DO UPDATE SET
            updated_at = NOW()
    ),
    -- Link tool to template_values (old ones already deleted above if update)
    link_template_values AS (
        INSERT INTO tool_template_values (tool_id, template_value_id, created_at, updated_at, generated, mcp)
        SELECT 
            x.tool_id,
            template_value_id,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN UNNEST(x.template_value_ids) as template_value_id
        WHERE COALESCE(array_length(x.template_value_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT tool_template_values_pkey DO UPDATE SET
            updated_at = NOW()
    )
    SELECT 
        x.tool_id AS tool_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
