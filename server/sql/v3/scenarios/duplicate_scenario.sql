-- Duplicate scenario with profile_id for auditing
-- Parameters: $1 = scenario_id (uuid), $2 = profile_id (uuid, required)
-- profile_id is always a UUID (required in request body)
actor_profile AS (
    SELECT 
        $2::uuid as resolved_profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
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
    FROM scenarios s
    LEFT JOIN scenario_problem_statements sps_j ON sps_j.scenario_id = s.id AND sps_j.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps_j.problem_statement_id
    WHERE s.id = $1::uuid
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
    RETURNING id::text as scenario_id
),
insert_tree_edge AS (
    INSERT INTO scenario_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT ns.scenario_id::uuid, ns.scenario_id::uuid, true, NOW(), NOW()
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
        ns.scenario_id::uuid,
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
        ns.scenario_id::uuid,
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
        ns.scenario_id::uuid,
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
        ns.scenario_id::uuid,
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
        ns.scenario_id::uuid,
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
        ns.scenario_id::uuid,
        sd.department_id,
        sd.active,
        NOW(),
        NOW()
    FROM source_scenario ss
    JOIN scenario_departments sd ON sd.scenario_id = ss.source_id AND sd.active = true
    CROSS JOIN new_scenario ns
)
SELECT 
    ns.scenario_id,
    ss.name as scenario_name,
    ap.actor_name
FROM new_scenario ns
CROSS JOIN source_scenario ss
CROSS JOIN actor_profile ap

