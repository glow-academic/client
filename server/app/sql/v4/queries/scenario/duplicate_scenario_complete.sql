-- Duplicate scenario with profile_id for auditing
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- If any other object depends on them, this will ERROR and stop the migration (good)
-- No composite types needed for this simple endpoint

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_scenario_v4(
    scenario_id uuid,
    profile_id uuid,
    group_id uuid DEFAULT NULL
)
RETURNS TABLE (
    scenario_id uuid,
    scenario_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT scenario_id AS scenario_id, profile_id AS profile_id, group_id AS group_id
),
default_call AS (
    SELECT id as call_id
    FROM view_calls_entry
    LIMIT 1
),
actor_profile AS (
    SELECT 
        p.id as resolved_profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
source_scenario AS (
    SELECT 
        s.id as source_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as name,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'objectives_enabled' AND sf.value = TRUE) as objectives_enabled,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'images_enabled' AND sf.value = TRUE) as images_enabled,
        ps.problem_statement,
        ps.id as problem_statement_id,
        ps.name as problem_statement_name
    FROM params x
    JOIN scenario_artifact s ON s.id = x.scenario_id
    LEFT JOIN scenario_problem_statements_junction sps_j ON sps_j.scenario_id = s.id AND sps_j.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps_j.problem_statement_id
),
get_or_create_name AS (
    -- Get or create name in names table
    INSERT INTO names_resource (name, created_at)
    SELECT ss.name || ' Copy', NOW()
    FROM source_scenario ss
    CROSS JOIN default_call dc
    WHERE ss.name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id
),
get_active_flag AS (
    -- Get the active flag ID
    SELECT id as flag_id
    FROM flags_resource
    WHERE name = 'active'
    LIMIT 1
),
get_objectives_enabled_flag AS (
    -- Get the objectives_enabled flag ID
    SELECT id as flag_id
    FROM flags_resource
    WHERE name = 'objectives_enabled'
    LIMIT 1
),
get_images_enabled_flag AS (
    -- Get the images_enabled flag ID
    SELECT id as flag_id
    FROM flags_resource
    WHERE name = 'images_enabled'
    LIMIT 1
),
ensure_group AS (
    INSERT INTO groups_entry (id, created_at, updated_at, session_id)
    SELECT p.group_id, NOW(), NOW(), (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = api_duplicate_scenario_v4.profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1)
    FROM params p
    WHERE p.group_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM view_groups_entry g WHERE g.id = p.group_id)
    RETURNING id
),
new_group AS (
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    SELECT NOW(), NOW(), (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = api_duplicate_scenario_v4.profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1)
    FROM params p
    WHERE p.group_id IS NULL
    RETURNING id
),
group_target AS (
    SELECT p.group_id AS group_id
    FROM params p
    WHERE p.group_id IS NOT NULL
    UNION ALL
    SELECT eg.id FROM ensure_group eg
    UNION ALL
    SELECT ng.id FROM new_group ng
    LIMIT 1
),
new_scenario AS (
    INSERT INTO scenario_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM source_scenario ss
    CROSS JOIN group_target gt
    RETURNING id
),
link_scenario_group AS (
    INSERT INTO scenario_groups_junction (scenario_id, group_id)
    SELECT ns.id, gt.group_id
    FROM new_scenario ns
    CROSS JOIN group_target gt
),
link_name AS (
    -- Link name to new scenario
    INSERT INTO scenario_names_junction (scenario_id, name_id, created_at)
    SELECT ns.id, gocn.name_id, NOW()
    FROM new_scenario ns
    CROSS JOIN get_or_create_name gocn
    WHERE gocn.name_id IS NOT NULL
),
link_active_flag AS (
    -- Link active flag to new scenario (set to false for duplicate)
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at) SELECT ns.id, gaf.flag_id, false, NOW()
    FROM new_scenario ns
    CROSS JOIN get_active_flag gaf
),
link_objectives_enabled_flag AS (
    -- Link objectives_enabled flag to new scenario
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
    SELECT ns.id, goef.flag_id, ss.objectives_enabled, NOW()
    FROM new_scenario ns
    CROSS JOIN source_scenario ss
    CROSS JOIN get_objectives_enabled_flag goef
    WHERE ss.objectives_enabled = true
),
link_images_enabled_flag AS (
    -- Link images_enabled flag to new scenario
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
    SELECT ns.id, gief.flag_id, ss.images_enabled, NOW()
    FROM new_scenario ns
    CROSS JOIN source_scenario ss
    CROSS JOIN get_images_enabled_flag gief
    WHERE ss.images_enabled = true
),
insert_tree_edge AS (
    INSERT INTO scenario_tree_junction (parent_id, child_id, active, created_at)
    SELECT ns.id, ns.id, true, NOW()
    FROM new_scenario ns
),
create_problem_statements AS (
    -- Create new problem_statement records (reuse if same text exists, but create new for history)
    INSERT INTO problem_statements_resource (name, problem_statement, created_at)
    SELECT DISTINCT
        COALESCE(ps.name, ss.name) as name,
        ps.problem_statement,
        NOW()
    FROM source_scenario ss
    JOIN scenario_problem_statements_junction sps_j ON sps_j.scenario_id = ss.source_id
    JOIN problem_statements_resource ps ON ps.id = sps_j.problem_statement_id
    CROSS JOIN default_call dc
    CROSS JOIN new_scenario ns
    RETURNING id as problem_statement_id, problem_statement
),
link_problem_statements AS (
    -- Link problem statements to new scenario via junction table
    INSERT INTO scenario_problem_statements_junction (scenario_id, problem_statement_id, active, created_at)
    SELECT 
        ns.id,
        cps.problem_statement_id,
        sps_j.active,
        NOW()
    FROM source_scenario ss
    JOIN scenario_problem_statements_junction sps_j ON sps_j.scenario_id = ss.source_id
    JOIN problem_statements_resource ps ON ps.id = sps_j.problem_statement_id
    JOIN create_problem_statements cps ON cps.problem_statement = ps.problem_statement
    CROSS JOIN new_scenario ns
),
copy_personas AS (
    INSERT INTO scenario_personas_junction (scenario_id, persona_id, active, created_at)
    SELECT 
        ns.id,
        sp.persona_id,
        sp.active,
        NOW()
    FROM source_scenario ss
    JOIN scenario_personas_junction sp ON sp.scenario_id = ss.source_id
    CROSS JOIN new_scenario ns
),
copy_documents AS (
    INSERT INTO scenario_documents_junction (scenario_id, document_id, active, created_at)
    SELECT 
        ns.id,
        sd.document_id,
        sd.active,
        NOW()
    FROM source_scenario ss
    JOIN scenario_documents_junction sd ON sd.scenario_id = ss.source_id
    CROSS JOIN new_scenario ns
),
source_objectives AS (
    -- Get objectives from source scenario
    SELECT 
        o.objective,
        so.idx
    FROM source_scenario ss
    JOIN scenario_objectives_junction so ON so.scenario_id = ss.source_id
    JOIN objectives_resource o ON o.id = so.objective_id
),
existing_objectives AS (
    -- Find existing objectives by text
    SELECT id as objective_id, objective
    FROM objectives_resource
    WHERE objective = ANY(SELECT objective FROM source_objectives)
),
new_objectives AS (
    -- Create new objectives that don't exist yet
    INSERT INTO objectives_resource (objective, created_at)
    SELECT DISTINCT
        so.objective,
        NOW()
    FROM source_objectives so
    CROSS JOIN default_call dc
    WHERE NOT EXISTS (
        SELECT 1 FROM existing_objectives eo WHERE eo.objective = so.objective
    )
    RETURNING id as objective_id, objective
),
all_objectives AS (
    -- Combine existing and new objectives
    SELECT objective_id, objective FROM existing_objectives
    UNION ALL
    SELECT objective_id, objective FROM new_objectives
),
link_objectives AS (
    -- Link objectives to new scenario via junction table
    INSERT INTO scenario_objectives_junction (scenario_id, objective_id, idx, created_at)
    SELECT 
        ns.id,
        ao.objective_id,
        so.idx,
        NOW()
    FROM source_objectives so
    JOIN all_objectives ao ON ao.objective = so.objective
    CROSS JOIN new_scenario ns
),
copy_parameters AS (
    INSERT INTO scenario_fields_junction (scenario_id, field_id, active, created_at)
    SELECT 
        ns.id,
        sf.field_id,
        sf.active,
        NOW()
    FROM source_scenario ss
    JOIN scenario_fields_junction sf ON sf.scenario_id = ss.source_id
    CROSS JOIN new_scenario ns
),
copy_departments AS (
    INSERT INTO scenario_departments_junction (scenario_id, department_id, active, created_at)
    SELECT 
        ns.id,
        sd.department_id,
        sd.active,
        NOW()
    FROM source_scenario ss
    JOIN scenario_departments_junction sd ON sd.scenario_id = ss.source_id AND sd.active = true
    CROSS JOIN new_scenario ns
)
SELECT 
    ns.id as scenario_id,
    ss.name::text as scenario_name,
    ap.actor_name::text as actor_name
FROM new_scenario ns
CROSS JOIN source_scenario ss
CROSS JOIN actor_profile ap
$$;
