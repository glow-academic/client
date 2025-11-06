-- Create scenario with all relationships in a single transaction
-- Parameters: $1=name, $2=active, $3=hints_enabled, $4=objectives_enabled, $5=image_input_enabled, 
--            $6=copy_paste_allowed, $7=input_guardrail_enabled, $8=output_guardrail_enabled,
--            $9=problem_statement (text), $10=problem_statement_versions (text array, nullable),
--            $11=department_ids (text array, nullable), $12=persona_ids (text array, nullable),
--            $13=document_ids (text array), $14=objective_ids (text array), 
--            $15=parameter_item_ids (text array, flattened from parameters dict)
-- Note: objective_ids should only contain new objective text (composite IDs like "scenarioId_idx" should be filtered out in Python)
-- Note: problem_statement_versions contains all versions; the one matching problem_statement should be active
WITH new_scenario AS (
    INSERT INTO scenarios (
        name,
        active,
        hints_enabled,
        objectives_enabled,
        image_input_enabled,
        copy_paste_allowed,
        input_guardrail_enabled,
        output_guardrail_enabled
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id::text as scenario_id
),
link_departments AS (
    -- Link departments if provided
    INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($11::text[]) as dept_id
    WHERE COALESCE(array_length($11::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_tree_edge AS (
    -- Insert self-referencing edge in scenario_tree (marks as root)
    INSERT INTO scenario_tree (parent_id, child_id, active)
    SELECT ns.scenario_id::uuid, ns.scenario_id::uuid, true
    FROM new_scenario ns
),
insert_problem_statements AS (
    -- Insert problem statement versions if provided, otherwise insert single problem statement
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        version_text,
        CASE 
            WHEN version_text = $9 THEN true  -- Active if matches problem_statement
            ELSE false
        END as active,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($10::text[]) as version_text
    WHERE COALESCE(array_length($10::text[], 1), 0) > 0
    UNION ALL
    -- If no versions provided, insert single problem statement as active
    SELECT 
        ns.scenario_id::uuid,
        $9::text,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    WHERE COALESCE(array_length($10::text[], 1), 0) = 0 AND $9::text IS NOT NULL AND $9::text != ''
),
link_personas AS (
    -- Link personas if provided
    INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($12::text[]) as persona_id
    WHERE COALESCE(array_length($12::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_documents AS (
    -- Link documents
    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        doc_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($13::text[]) as doc_id
    WHERE COALESCE(array_length($13::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
objectives_with_index AS (
    -- Prepare objectives with their index (skip composite IDs - filtered in Python)
    SELECT 
        obj_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST($14::text[]) as obj_text
    WHERE COALESCE(array_length($14::text[], 1), 0) > 0
),
link_objectives AS (
    -- Insert objectives
    INSERT INTO scenario_objectives (scenario_id, idx, objective, created_at)
    SELECT 
        ns.scenario_id::uuid,
        owi.idx,
        owi.obj_text,
        NOW()
    FROM new_scenario ns
    CROSS JOIN objectives_with_index owi
),
link_parameters AS (
    -- Link parameter items
    INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active, created_at, updated_at)
    SELECT 
        ns.scenario_id::uuid,
        param_item_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_scenario ns
    CROSS JOIN UNNEST($15::text[]) as param_item_id
    WHERE COALESCE(array_length($15::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_item_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT scenario_id FROM new_scenario

