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
    profile_id uuid
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
    SELECT scenario_id AS scenario_id, profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        p.id as resolved_profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
source_scenario AS (
    SELECT 
        s.id as source_id,
        s.name,
        s.objectives_enabled,
        s.images_enabled,
        ps.problem_statement,
        ps.id as problem_statement_id,
        ps.name as problem_statement_name
    FROM params x
    JOIN scenarios s ON s.id = x.scenario_id
    LEFT JOIN scenario_problem_statements sps_j ON sps_j.scenario_id = s.id AND sps_j.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps_j.problem_statement_id
),
new_scenario AS (
    INSERT INTO scenarios (
        name,
        active,
        objectives_enabled,
        images_enabled,
        created_at,
        updated_at
    )
    SELECT 
        ss.name || ' Copy',
        false,
        ss.objectives_enabled,
        ss.images_enabled,
        NOW(),
        NOW()
    FROM source_scenario ss
    RETURNING id
),
insert_tree_edge AS (
    INSERT INTO scenario_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT ns.id, ns.id, true, NOW(), NOW()
    FROM new_scenario ns
),
create_problem_statements AS (
    -- Create new problem_statement records (reuse if same text exists, but create new for history)
    INSERT INTO problem_statements (name, problem_statement, created_at, updated_at)
    SELECT DISTINCT
        COALESCE(ps.name, ss.name) as name,
        ps.problem_statement,
        NOW(),
        NOW()
    FROM source_scenario ss
    JOIN scenario_problem_statements sps_j ON sps_j.scenario_id = ss.source_id
    JOIN problem_statements ps ON ps.id = sps_j.problem_statement_id
    CROSS JOIN new_scenario ns
    RETURNING id as problem_statement_id, problem_statement
),
link_problem_statements AS (
    -- Link problem statements to new scenario via junction table
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        cps.problem_statement_id,
        sps_j.active,
        NOW(),
        NOW()
    FROM source_scenario ss
    JOIN scenario_problem_statements sps_j ON sps_j.scenario_id = ss.source_id
    JOIN problem_statements ps ON ps.id = sps_j.problem_statement_id
    JOIN create_problem_statements cps ON cps.problem_statement = ps.problem_statement
    CROSS JOIN new_scenario ns
),
copy_personas AS (
    INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        sp.persona_id,
        sp.active,
        NOW(),
        NOW()
    FROM source_scenario ss
    JOIN scenario_personas sp ON sp.scenario_id = ss.source_id
    CROSS JOIN new_scenario ns
),
copy_documents AS (
    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        sd.document_id,
        sd.active,
        NOW(),
        NOW()
    FROM source_scenario ss
    JOIN scenario_documents sd ON sd.scenario_id = ss.source_id
    CROSS JOIN new_scenario ns
),
source_objectives AS (
    -- Get objectives from source scenario
    SELECT 
        o.objective,
        so.idx
    FROM source_scenario ss
    JOIN scenario_objectives so ON so.scenario_id = ss.source_id
    JOIN objectives o ON o.id = so.objective_id
),
existing_objectives AS (
    -- Find existing objectives by text
    SELECT id as objective_id, objective
    FROM objectives
    WHERE objective = ANY(SELECT objective FROM source_objectives)
),
new_objectives AS (
    -- Create new objectives that don't exist yet
    INSERT INTO objectives (objective, created_at, updated_at)
    SELECT DISTINCT
        so.objective,
        NOW(),
        NOW()
    FROM source_objectives so
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
    INSERT INTO scenario_objectives (scenario_id, objective_id, idx, created_at)
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
    INSERT INTO scenario_fields (scenario_id, field_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        sf.field_id,
        sf.active,
        NOW(),
        NOW()
    FROM source_scenario ss
    JOIN scenario_fields sf ON sf.scenario_id = ss.source_id
    CROSS JOIN new_scenario ns
),
copy_departments AS (
    INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
    SELECT 
        ns.id,
        sd.department_id,
        sd.active,
        NOW(),
        NOW()
    FROM source_scenario ss
    JOIN scenario_departments sd ON sd.scenario_id = ss.source_id AND sd.active = true
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