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
    SELECT actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
original_tool AS (
    SELECT 
        t.id,
        (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        (SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) as active
    FROM params x
    JOIN tool_artifact t ON t.id = x.tool_id
),
original_args AS (
    -- Get args IDs from original tool
    SELECT args_id
    FROM params x
    JOIN tool_args_junction ta ON ta.tool_id = x.tool_id
),
original_args_outputs AS (
    -- Get args_outputs IDs from original tool
    SELECT args_outputs_id
    FROM params x
    JOIN tool_args_outputs_junction tao ON tao.tool_id = x.tool_id
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
    INSERT INTO names_resource (name, created_at, active, generated, mcp)
    SELECT
        ot.name || ' Copy',
        NOW(),
        true,
        false,
        false
    FROM original_tool ot
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id
),
link_new_tool_name AS (
    INSERT INTO tool_names_junction (tool_id, name_id, created_at, generated, mcp)
    SELECT 
        nt.id,
        ntn.name_id,
        NOW(),
        false,
        false
    FROM new_tool nt
    CROSS JOIN new_tool_name ntn
    RETURNING tool_id
),
-- Insert description for new tool
new_tool_description AS (
    INSERT INTO descriptions_resource (description, created_at, active, generated, mcp)
    SELECT
        ot.description,
        NOW(),
        true,
        false,
        false
    FROM original_tool ot
    WHERE ot.description IS NOT NULL
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as description_id
),
link_new_tool_description AS (
    INSERT INTO tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp)
    SELECT 
        nt.id,
        ntd.description_id,
        NOW(),
        false,
        false
    FROM new_tool nt
    CROSS JOIN new_tool_description ntd
    RETURNING tool_id
),
-- Insert active flag for new tool
new_tool_active_flag AS (
    INSERT INTO tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp) SELECT nt.id,
        f.id,
        ot.active,
        NOW(),
        false,
        false
    FROM new_tool nt
    CROSS JOIN original_tool ot
    CROSS JOIN flags_resource f
    WHERE f.name = 'tool_active'
    RETURNING tool_id
),
-- Copy args links from original tool
copy_args AS (
    INSERT INTO tool_args_junction (tool_id, args_id, created_at)
    SELECT 
        nt.id,
        oa.args_id,
        NOW()
    FROM new_tool nt
    CROSS JOIN original_args oa
    RETURNING tool_id
),
-- Copy args_outputs links from original tool
copy_args_outputs AS (
    INSERT INTO tool_args_outputs_junction (tool_id, args_outputs_id, created_at)
    SELECT 
        nt.id,
        oao.args_outputs_id,
        NOW()
    FROM new_tool nt
    CROSS JOIN original_args_outputs oao
    RETURNING tool_id
)
SELECT 
    (SELECT id FROM new_tool LIMIT 1) as new_tool_id,
    (SELECT name FROM original_tool LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;
