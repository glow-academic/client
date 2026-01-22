-- Get tools list with permissions
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_tools_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tools_list_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_tools_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_tools_list_v4_tool AS (
    tool_id uuid,
    name text,
    description text,
    active boolean,
    num_schemas int,
    num_templates int,
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean,
    updated_at timestamptz
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_tools_list_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    tools types.q_get_tools_list_v4_tool[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) LIMIT 1),
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
tool_args_counts AS (
    SELECT 
        ta.tool_id,
        COUNT(*) as num_schemas  -- Keep name for backward compatibility
    FROM tool_args ta
    GROUP BY ta.tool_id
),
tool_args_outputs_counts AS (
    SELECT 
        tao.tool_id,
        COUNT(*) as num_templates  -- Keep name for backward compatibility
    FROM tool_args_outputs tao
    GROUP BY tao.tool_id
),
tool_usage_counts AS (
    SELECT 
        t.id as tool_id,
        COALESCE(
            (SELECT COUNT(*) FROM calls_entry c WHERE c.tool_id = t.id),
            0
        ) as usage_count
    FROM tool_artifact t
),
tool_data_base AS (
    SELECT 
        t.id as tool_id,
        (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        (SELECT d.description FROM tool_descriptions td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) as active,
        t.updated_at,
        COALESCE(tac.num_schemas, 0) as num_schemas,
        COALESCE(taoc.num_templates, 0) as num_templates,
        COALESCE(tuc.usage_count, 0) as usage_count
    FROM tool_artifact t
    LEFT JOIN tool_args_counts tac ON tac.tool_id = t.id
    LEFT JOIN tool_args_outputs_counts taoc ON taoc.tool_id = t.id
    LEFT JOIN tool_usage_counts tuc ON tuc.tool_id = t.id
),
tool_data AS (
    SELECT 
        tdb.*,
        CASE 
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) 
                 AND tdb.usage_count = 0 THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_duplicate
    FROM tool_data_base tdb
    CROSS JOIN user_profile up
)
SELECT 
    up.actor_name::text as actor_name,
    -- Aggregate tools
    COALESCE(
        (SELECT ARRAY_AGG(
            (td.tool_id, td.name, td.description, td.active, td.num_schemas, 
             td.num_templates, td.can_edit, td.can_delete, td.can_duplicate, td.updated_at
            )::types.q_get_tools_list_v4_tool
            ORDER BY td.updated_at DESC NULLS LAST
        ) FROM tool_data td),
        '{}'::types.q_get_tools_list_v4_tool[]
    ) as tools
FROM user_profile up
$$;
