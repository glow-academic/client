-- Insert scenario variant (for child scenarios)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_scenario_variant_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_scenario_variant_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_scenario_variant_v4(
    name text,
    generated boolean,
    active boolean,
    objectives_enabled boolean,
    images_enabled boolean
)
RETURNS TABLE (
    id uuid,
    name text,
    generated boolean,
    active boolean,
    objectives_enabled boolean,
    images_enabled boolean,
    description text,
    root_scenario_id uuid,
    parent_scenario_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    profile_id uuid,
    department_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        api_insert_scenario_variant_v4.name AS name,
        api_insert_scenario_variant_v4.generated AS generated,
        api_insert_scenario_variant_v4.active AS active,
        api_insert_scenario_variant_v4.objectives_enabled AS objectives_enabled,
        api_insert_scenario_variant_v4.images_enabled AS images_enabled
),
default_call AS (
    SELECT id as call_id
    FROM calls_entry
    LIMIT 1
),
get_or_create_name AS (
    INSERT INTO names_resource (name, created_at, updated_at, call_id)
    SELECT p.name, NOW(), NOW(), dc.call_id
    FROM params p
    CROSS JOIN default_call dc
    WHERE p.name IS NOT NULL AND p.name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name as name_value
),
get_flag_ids AS (
    SELECT 
        (SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1) as active_flag_id,
        (SELECT id FROM flags_resource WHERE name = 'objectives_enabled' LIMIT 1) as objectives_enabled_flag_id,
        (SELECT id FROM flags_resource WHERE name = 'images_enabled' LIMIT 1) as images_enabled_flag_id
),
new_group AS (
    INSERT INTO groups_entry (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id
),
new_scenario AS (
    INSERT INTO scenario_artifact (
        group_id,
        created_at,
        updated_at
    )
    SELECT ng.id, NOW(), NOW()
    FROM new_group ng
    RETURNING id
),
link_name AS (
    INSERT INTO scenario_names_junction (scenario_id, name_id, created_at, updated_at)
    SELECT ns.id, gocn.name_id, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN get_or_create_name gocn
    WHERE gocn.name_id IS NOT NULL
),
link_flags AS (
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at, updated_at) SELECT ns.id, gfi.active_flag_id, p.active, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN params p
    CROSS JOIN get_flag_ids gfi
    WHERE p.active IS NOT NULL
    UNION ALL
    SELECT ns.id, gfi.objectives_enabled_flag_id, p.objectives_enabled, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN params p
    CROSS JOIN get_flag_ids gfi
    WHERE p.objectives_enabled IS NOT NULL
    UNION ALL
    SELECT ns.id, gfi.images_enabled_flag_id, p.images_enabled, NOW(), NOW()
    FROM new_scenario ns
    CROSS JOIN params p
    CROSS JOIN get_flag_ids gfi
    WHERE p.images_enabled IS NOT NULL
)
SELECT 
    ns.id,
    gocn.name_value,
    p.generated,
    p.active,
    p.objectives_enabled,
    p.images_enabled,
    ''::text as description,
    (SELECT st.parent_id FROM scenario_tree_entry st WHERE st.child_id = ns.id AND st.parent_id != ns.id LIMIT 1) as root_scenario_id,
    (SELECT st.parent_id FROM scenario_tree_entry st WHERE st.child_id = ns.id AND st.parent_id != ns.id LIMIT 1) as parent_scenario_id,
    (SELECT created_at FROM scenario_artifact WHERE id = ns.id LIMIT 1) as created_at,
    (SELECT updated_at FROM scenario_artifact WHERE id = ns.id LIMIT 1) as updated_at,
    NULL::uuid as profile_id,
    (SELECT sd.department_id FROM scenario_departments_junction sd WHERE sd.scenario_id = ns.id AND sd.active = true LIMIT 1) as department_id
FROM new_scenario ns
CROSS JOIN params p
LEFT JOIN get_or_create_name gocn ON gocn.name_id IS NOT NULL
$$;
