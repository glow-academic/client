-- Duplicate simulation with all relationships
-- Converted to function
-- 1) Drop function first
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_simulation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_simulation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_simulation_v4(
    simulation_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    simulation_id uuid,
    simulation_name text,
    actor_name text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT simulation_id AS simulation_id,
           profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        x.profile_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
source_simulation AS (
    SELECT 
        s.id as source_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as title,
        COALESCE((SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1), '') as description
    FROM params x
    JOIN simulation_artifact s ON s.id = x.simulation_id
),
default_call AS (
    SELECT id as call_id
    FROM calls_entry
    LIMIT 1
),
get_or_create_name AS (
    INSERT INTO names_resource (name, created_at)
    SELECT ss.title || ' Copy', NOW()
    FROM source_simulation ss
    CROSS JOIN default_call dc
    WHERE ss.title IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id, name as name_value
),
get_or_create_description AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT ss.description, NOW()
    FROM source_simulation ss
    CROSS JOIN default_call dc
    WHERE ss.description IS NOT NULL AND ss.description != ''
    RETURNING id as description_id
),
get_flag_ids AS (
    SELECT 
        (SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1) as active_flag_id,
        (SELECT id FROM flags_resource WHERE name = 'practice' LIMIT 1) as practice_flag_id
),
new_simulation AS (
    INSERT INTO simulation_artifact (
        created_at,
        updated_at
    )
    SELECT NOW(), NOW()
    FROM source_simulation ss
    RETURNING id as simulation_id
),
link_name AS (
    INSERT INTO simulation_names_junction (simulation_id, name_id, created_at)
    SELECT ns.simulation_id, gocn.name_id, NOW()
    FROM new_simulation ns
    CROSS JOIN get_or_create_name gocn
    WHERE gocn.name_id IS NOT NULL
),
link_description AS (
    INSERT INTO simulation_descriptions_junction (simulation_id, description_id, created_at)
    SELECT ns.simulation_id, gocd.description_id, NOW()
    FROM new_simulation ns
    CROSS JOIN get_or_create_description gocd
    WHERE gocd.description_id IS NOT NULL
),
link_flags AS (
    INSERT INTO simulation_flags_junction (simulation_id, flag_id, value, created_at) SELECT ns.simulation_id, gfi.active_flag_id, false, NOW()
    FROM new_simulation ns
    CROSS JOIN get_flag_ids gfi
    UNION ALL
    SELECT ns.simulation_id, gfi.practice_flag_id, false, NOW()
    FROM new_simulation ns
    CROSS JOIN get_flag_ids gfi
),
copy_scenarios AS (
    INSERT INTO simulation_scenarios_junction (simulation_id, scenario_id, created_at)
    SELECT 
        ns.simulation_id,
        ss.scenario_id,
        NOW()
    FROM source_simulation ssim
    JOIN simulation_scenarios_junction ss ON ss.simulation_id = ssim.source_id
    CROSS JOIN new_simulation ns
),
copy_scenario_positions AS (
    INSERT INTO simulation_scenario_positions_junction (simulation_id, scenario_position_id, active, created_at)
    SELECT 
        ns.simulation_id,
        spr.id,
        ssp.active,
        NOW()
    FROM source_simulation ssim
    JOIN simulation_scenario_positions_junction ssp ON ssp.simulation_id = ssim.source_id
    JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
    CROSS JOIN new_simulation ns
),
copy_scenario_flags AS (
    INSERT INTO simulation_scenario_flags_junction (simulation_id, scenario_flag_id, value, created_at, generated, mcp)
    SELECT 
        ns.simulation_id,
        ssf.scenario_flag_id,
        ssf.value,
        NOW(),
        ssf.generated,
        ssf.mcp
    FROM source_simulation ssim
    JOIN simulation_scenario_flags_junction ssf ON ssf.simulation_id = ssim.source_id
    CROSS JOIN new_simulation ns
),
copy_rubric_links AS (
    INSERT INTO simulation_scenario_rubrics_junction (simulation_id, scenario_rubric_id, active, created_at)
    SELECT 
        ns.simulation_id,
        ssr.scenario_rubric_id,
        ssr.active,
        NOW()
    FROM source_simulation ssim
    JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ssim.source_id
    CROSS JOIN new_simulation ns
),
copy_departments AS (
    INSERT INTO simulation_departments_junction (simulation_id, department_id, active, created_at)
    SELECT 
        ns.simulation_id,
        sd.department_id,
        sd.active,
        NOW()
    FROM source_simulation ssim
    JOIN simulation_departments_junction sd ON sd.simulation_id = ssim.source_id AND sd.active = true
    CROSS JOIN new_simulation ns
)
SELECT 
    ns.simulation_id,
    COALESCE(gocn.name_value, '')::text as simulation_name,
    ap.actor_name::text as actor_name
FROM new_simulation ns
CROSS JOIN source_simulation ss
LEFT JOIN get_or_create_name gocn ON gocn.name_id IS NOT NULL
CROSS JOIN actor_profile ap
$$;