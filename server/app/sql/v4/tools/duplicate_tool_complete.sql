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
        t.name,
        t.description,
        t.active
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
        name,
        description,
        active,
        created_at,
        updated_at
    )
    SELECT 
        name || ' Copy',
        description,
        active,
        NOW(),
        NOW()
    FROM original_tool ot
    RETURNING id
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
