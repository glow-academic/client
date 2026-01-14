-- Duplicate tool - fetches original and creates copy with schema and template links
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
        WHERE proname = 'api_duplicate_tool_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_tool_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_tool_v4(
    tool_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_tool_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT tool_id AS tool_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_tool AS (
    SELECT 
        t.id,
        (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        (SELECT d.description FROM tool_descriptions td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true) as active
    FROM params x
    JOIN tool_artifact t ON t.id = x.tool_id
),
original_schemas AS (
    -- Get schema IDs from original tool
    SELECT schema_id
    FROM params x
    JOIN tool_schemas ts ON ts.tool_id = x.tool_id
),
original_templates AS (
    -- Get template IDs from original tool
    SELECT template_id
    FROM params x
    JOIN tool_templates tt ON tt.tool_id = x.tool_id
),
new_tool AS (
    INSERT INTO tool_artifact (
        created_at,
        updated_at
    )
    SELECT 
        NOW(),
        NOW()
    FROM original_tool ot
    RETURNING id
),
-- Insert name for new tool
new_tool_name AS (
    INSERT INTO names_resource (name, created_at, updated_at, active, generated, mcp, call_id)
    SELECT 
        ot.name || ' Copy',
        NOW(),
        NOW(),
        true,
        false,
        false,
        NULL
    FROM original_tool ot
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
link_new_tool_name AS (
    INSERT INTO tool_names (tool_id, name_id, created_at, updated_at, generated, mcp)
    SELECT 
        nt.id,
        ntn.name_id,
        NOW(),
        NOW(),
        false,
        false
    FROM new_tool nt
    CROSS JOIN new_tool_name ntn
    RETURNING tool_id
),
-- Insert description for new tool
new_tool_description AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at, active, generated, mcp, call_id)
    SELECT 
        ot.description,
        NOW(),
        NOW(),
        true,
        false,
        false,
        NULL
    FROM original_tool ot
    WHERE ot.description IS NOT NULL
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
link_new_tool_description AS (
    INSERT INTO tool_descriptions (tool_id, description_id, created_at, updated_at, generated, mcp)
    SELECT 
        nt.id,
        ntd.description_id,
        NOW(),
        NOW(),
        false,
        false
    FROM new_tool nt
    CROSS JOIN new_tool_description ntd
    RETURNING tool_id
),
-- Insert active flag for new tool
new_tool_active_flag AS (
    INSERT INTO tool_flags (tool_id, flag_id, type, value, created_at, updated_at, generated, mcp, call_id)
    SELECT 
        nt.id,
        f.id,
        'active'::type_tool_flags,
        ot.active,
        NOW(),
        NOW(),
        false,
        false,
        NULL
    FROM new_tool nt
    CROSS JOIN original_tool ot
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    RETURNING tool_id
),
-- Copy schema links from original tool
copy_schemas AS (
    INSERT INTO tool_schemas (tool_id, schema_id, created_at, updated_at, generated, mcp)
    SELECT 
        nt.id,
        os.schema_id,
        NOW(),
        NOW(),
        false,
        false
    FROM new_tool nt
    CROSS JOIN original_schemas os
    RETURNING tool_id
),
-- Copy template links from original tool
copy_templates AS (
    INSERT INTO tool_templates (tool_id, template_id, created_at, updated_at, generated, mcp)
    SELECT 
        nt.id,
        ot.template_id,
        NOW(),
        NOW(),
        false,
        false
    FROM new_tool nt
    CROSS JOIN original_templates ot
    RETURNING tool_id
)
SELECT 
    (SELECT id FROM new_tool LIMIT 1) as new_tool_id,
    (SELECT name FROM original_tool LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;
