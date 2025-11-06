WITH source_scenario AS (
    SELECT 
        s.id as source_id,
        s.name,
        s.hints_enabled,
        s.objectives_enabled,
        s.image_input_enabled,
        s.copy_paste_allowed,
        s.input_guardrail_enabled,
        s.output_guardrail_enabled,
        sps.problem_statement
    FROM scenarios s
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    WHERE s.id = $1::uuid
),
new_scenario AS (
    INSERT INTO scenarios (
        name,
        active,
        hints_enabled,
        objectives_enabled,
        image_input_enabled,
        copy_paste_allowed,
        input_guardrail_enabled,
        output_guardrail_enabled,
        created_at,
        updated_at
    )
    SELECT 
        ss.name || ' Copy',
        false,
        ss.hints_enabled,
        ss.objectives_enabled,
        ss.image_input_enabled,
        ss.copy_paste_allowed,
        ss.input_guardrail_enabled,
        ss.output_guardrail_enabled,
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
copy_problem_statements AS (
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        sps.problem_statement,
        sps.active,
        NOW(),
        NOW()
    FROM source_scenario ss
    JOIN scenario_problem_statements sps ON sps.scenario_id = ss.source_id
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
copy_objectives AS (
    INSERT INTO scenario_objectives (scenario_id, idx, objective, created_at)
    SELECT 
        ns.scenario_id::uuid,
        so.idx,
        so.objective,
        NOW()
    FROM source_scenario ss
    JOIN scenario_objectives so ON so.scenario_id = ss.source_id
    CROSS JOIN new_scenario ns
),
copy_parameters AS (
    INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        spi.parameter_item_id,
        spi.active,
        NOW(),
        NOW()
    FROM source_scenario ss
    JOIN scenario_parameter_items spi ON spi.scenario_id = ss.source_id
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
SELECT scenario_id FROM new_scenario

