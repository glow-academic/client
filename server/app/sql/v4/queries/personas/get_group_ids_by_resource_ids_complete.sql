-- Get group_ids for persona resources by resource IDs directly
-- Returns group_id for each resource ID by following the chain:
-- Resource → call_id → view_calls_entry.id → view_calls_entry.run_id → view_runs_entry.group_id
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_group_ids_by_resource_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_group_ids_by_resource_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_get_group_ids_by_resource_ids_v4(
    profile_id uuid,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    color_id uuid DEFAULT NULL,
    icon_id uuid DEFAULT NULL,
    instructions_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL,
    example_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    resource_type text,
    resource_id uuid,
    group_id uuid
)
LANGUAGE sql
STABLE
AS $$
-- Names group_id lookup
WITH names_group_ids AS (
    SELECT 
        'names'::text as resource_type,
        n.id as resource_id,
        r.group_id
    FROM names_resource n
    LEFT JOIN names_calls_connection ncc ON ncc.names_id = n.id LEFT JOIN view_calls_entry c ON c.id = ncc.call_id
    LEFT JOIN view_runs_entry r ON r.id = c.run_id
    WHERE name_id IS NOT NULL AND n.id = name_id
),
-- Descriptions group_id lookup
descriptions_group_ids AS (
    SELECT 
        'descriptions'::text as resource_type,
        d.id as resource_id,
        r.group_id
    FROM descriptions_resource d
    LEFT JOIN descriptions_calls_connection dcc ON dcc.descriptions_id = d.id LEFT JOIN view_calls_entry c ON c.id = dcc.call_id
    LEFT JOIN view_runs_entry r ON r.id = c.run_id
    WHERE description_id IS NOT NULL AND d.id = description_id
),
-- Colors group_id lookup
colors_group_ids AS (
    SELECT
        'colors'::text as resource_type,
        col.id as resource_id,
        r.group_id
    FROM colors_resource col
    LEFT JOIN colors_calls_connection ccc ON ccc.colors_id = col.id
    LEFT JOIN view_calls_entry c ON c.id = ccc.call_id
    LEFT JOIN view_runs_entry r ON r.id = c.run_id
    WHERE color_id IS NOT NULL AND col.id = color_id
),
-- Icons group_id lookup
icons_group_ids AS (
    SELECT
        'icons'::text as resource_type,
        i.id as resource_id,
        r.group_id
    FROM icons_resource i
    LEFT JOIN icons_calls_connection icc ON icc.icons_id = i.id
    LEFT JOIN view_calls_entry c ON c.id = icc.call_id
    LEFT JOIN view_runs_entry r ON r.id = c.run_id
    WHERE icon_id IS NOT NULL AND i.id = icon_id
),
-- Instructions group_id lookup
instructions_group_ids AS (
    SELECT
        'instructions'::text as resource_type,
        inst.id as resource_id,
        r.group_id
    FROM instructions_resource inst
    LEFT JOIN instructions_calls_connection instcc ON instcc.instructions_id = inst.id
    LEFT JOIN view_calls_entry c ON c.id = instcc.call_id
    LEFT JOIN view_runs_entry r ON r.id = c.run_id
    WHERE instructions_id IS NOT NULL AND inst.id = instructions_id
),
-- Flags group_id lookup
flags_group_ids AS (
    SELECT 
        'flags'::text as resource_type,
        f.id as resource_id,
        r.group_id
    FROM flags_resource f
    LEFT JOIN flags_calls_connection fcc ON fcc.flags_id = f.id LEFT JOIN view_calls_entry c ON c.id = fcc.call_id
    LEFT JOIN view_runs_entry r ON r.id = c.run_id
    WHERE active_flag_id IS NOT NULL AND f.id = active_flag_id
),
-- Departments group_id lookup (for each selected department)
departments_group_ids AS (
    SELECT
        'departments'::text as resource_type,
        d.id as resource_id,
        r.group_id
    FROM departments_resource d
    LEFT JOIN departments_calls_connection depcc ON depcc.departments_id = d.id
    LEFT JOIN view_calls_entry c ON c.id = depcc.call_id
    LEFT JOIN view_runs_entry r ON r.id = c.run_id
    WHERE department_ids IS NOT NULL AND d.id = ANY(department_ids)
),
-- Fields group_id lookup (for each selected field)
fields_group_ids AS (
    SELECT
        'fields'::text as resource_type,
        f.id as resource_id,
        r.group_id
    FROM fields_resource f
    LEFT JOIN fields_calls_connection fieldcc ON fieldcc.fields_id = f.id
    LEFT JOIN view_calls_entry c ON c.id = fieldcc.call_id
    LEFT JOIN view_runs_entry r ON r.id = c.run_id
    WHERE field_ids IS NOT NULL AND f.id = ANY(field_ids)
),
-- Examples group_id lookup (for each selected example)
examples_group_ids AS (
    SELECT
        'examples'::text as resource_type,
        e.id as resource_id,
        r.group_id
    FROM examples_resource e
    LEFT JOIN examples_calls_connection excc ON excc.examples_id = e.id
    LEFT JOIN view_calls_entry c ON c.id = excc.call_id
    LEFT JOIN view_runs_entry r ON r.id = c.run_id
    WHERE example_ids IS NOT NULL AND e.id = ANY(example_ids)
)
SELECT resource_type, resource_id, group_id FROM names_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM descriptions_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM colors_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM icons_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM instructions_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM flags_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM departments_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM fields_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM examples_group_ids WHERE resource_id IS NOT NULL
$$;
