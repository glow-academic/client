-- Update scenario with all relationships in a single transaction
-- Parameters: $1=scenarioId, $2=name, $3=active, $4=hints_enabled, $5=objectives_enabled,
--            $6=image_input_enabled, $7=copy_paste_allowed, $8=input_guardrail_enabled,
--            $9=output_guardrail_enabled, $10=problem_statement (text),
--            $11=department_ids (text array, nullable), $12=persona_ids (text array, nullable),
--            $13=document_ids (text array), $14=objective_ids (text array),
--            $15=parameter_item_ids (text array, flattened from parameters dict)
-- Returns: scenario_id, name if updated, or no rows if scenario doesn't exist
-- Note: objective_ids should only contain new objective text (composite IDs filtered in Python)
WITH scenario_exists AS (
    -- Check if scenario exists
    SELECT id, name
    FROM scenarios
    WHERE id = $1::uuid
),
update_scenario AS (
    -- Update scenario basic fields
    UPDATE scenarios
    SET 
        name = $2,
        active = $3,
        hints_enabled = $4,
        objectives_enabled = $5,
        image_input_enabled = $6,
        copy_paste_allowed = $7,
        input_guardrail_enabled = $8,
        output_guardrail_enabled = $9,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM scenario_exists)
    RETURNING id::text as scenario_id, name
),
deactivate_problem_statements AS (
    -- Deactivate all existing problem statements (preserve history)
    -- Return rows to ensure this CTE executes
    UPDATE scenario_problem_statements
    SET active = false, updated_at = NOW()
    WHERE scenario_id = $1::uuid AND active = true
    RETURNING id
),
create_problem_statement AS (
    -- Create new problem statement version (always create new for history)
    -- Reference deactivate_problem_statements to ensure it executes first
    -- This ensures deactivation happens before insertion, avoiding unique constraint violation
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $10::text,
        true,
        NOW(),
        NOW()
    WHERE EXISTS (SELECT 1 FROM scenario_exists) 
      AND $10::text IS NOT NULL 
      AND $10::text != ''
      AND (
          EXISTS (SELECT 1 FROM deactivate_problem_statements)
          OR NOT EXISTS (SELECT 1 FROM scenario_problem_statements WHERE scenario_id = $1::uuid AND active = true)
      )
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM scenario_departments 
    WHERE scenario_id = $1::uuid
),
insert_departments AS (
    -- Insert new department links
    INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($11::text[]) as dept_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($11::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_personas AS (
    -- Delete all existing persona links
    DELETE FROM scenario_personas 
    WHERE scenario_id = $1::uuid
),
insert_personas AS (
    -- Insert new persona links
    INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($12::text[]) as persona_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($12::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_documents AS (
    -- Delete all existing document links
    DELETE FROM scenario_documents 
    WHERE scenario_id = $1::uuid
),
insert_documents AS (
    -- Insert new document links
    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        doc_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($13::text[]) as doc_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($13::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_objectives AS (
    -- Delete all existing objectives
    DELETE FROM scenario_objectives 
    WHERE scenario_id = $1::uuid
),
objectives_with_index AS (
    -- Prepare objectives with their index
    SELECT 
        obj_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST($14::text[]) as obj_text
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($14::text[], 1), 0) > 0
),
insert_objectives AS (
    -- Insert new objectives
    INSERT INTO scenario_objectives (scenario_id, idx, objective, created_at)
    SELECT 
        $1::uuid,
        owi.idx,
        owi.obj_text,
        NOW()
    FROM objectives_with_index owi
),
replace_parameters AS (
    -- Delete all existing parameter links
    DELETE FROM scenario_parameter_items 
    WHERE scenario_id = $1::uuid
),
insert_parameters AS (
    -- Insert new parameter links
    INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        param_item_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($15::text[]) as param_item_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($15::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_item_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT scenario_id, name FROM update_scenario

