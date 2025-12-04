-- Update scenario with all relationships in a single transaction
-- Parameters: $1=scenarioId, $2=name, $3=active, $4=documents_enabled, $5=document_vision_enabled,
--            $6=objectives_enabled, $7=image_enabled, $8=problem_statement (text),
--            $9=problem_statement_name (text, nullable - defaults to scenario name),
--            $10=department_ids (text array, nullable), $11=persona_ids (text array, nullable),
--            $12=document_ids (text array), $13=objective_ids (text array),
--            $14=parameter_item_ids (text array, flattened from parameters dict),
--            $15=upload_images_json (JSONB string with upload images array), $16=scenario_agent_id (nullable uuid), $17=image_agent_id (nullable uuid)
-- Upload images JSON structure: [{"upload_id": "...", "name": "..."}]
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
        documents_enabled = $4,
        document_vision_enabled = $5,
        objectives_enabled = $6,
        image_enabled = $7,
        scenario_agent_id = COALESCE($16::uuid, scenario_agent_id),
        image_agent_id = COALESCE($17::uuid, image_agent_id),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM scenario_exists)
    RETURNING id::text as scenario_id, name
),
deactivate_problem_statements AS (
    -- Deactivate all existing problem statement links (preserve history)
    UPDATE scenario_problem_statements
    SET active = false, updated_at = NOW()
    WHERE scenario_id = $1::uuid AND active = true
    RETURNING problem_statement_id
),
create_problem_statement AS (
    -- Create new problem_statement record (strong entity)
    INSERT INTO problem_statements (name, problem_statement, created_at, updated_at)
    SELECT 
        COALESCE($9::text, $2::text) as name,  -- Use provided name or scenario name
        $8::text,
        NOW(),
        NOW()
    WHERE EXISTS (SELECT 1 FROM scenario_exists) 
      AND $9::text IS NOT NULL 
      AND $9::text != ''
    RETURNING id as problem_statement_id
),
link_problem_statement AS (
    -- Link new problem statement to scenario via junction table
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        cps.problem_statement_id,
        true,
        NOW(),
        NOW()
    FROM create_problem_statement cps
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
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
    FROM UNNEST($10::text[]) as dept_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($10::text[], 1), 0) > 0
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
    FROM UNNEST($11::text[]) as persona_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($11::text[], 1), 0) > 0
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
    FROM UNNEST($12::text[]) as doc_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($13::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_objectives AS (
    -- Delete all existing objective links
    DELETE FROM scenario_objectives 
    WHERE scenario_id = $1::uuid
),
objectives_with_index AS (
    -- Prepare objectives with their index
    SELECT 
        obj_text,
        ROW_NUMBER() OVER () - 1 as idx
    FROM UNNEST($13::text[]) as obj_text
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($13::text[], 1), 0) > 0
),
existing_objectives AS (
    -- Find existing objectives by text
    SELECT id as objective_id, objective
    FROM objectives
    WHERE objective = ANY(SELECT obj_text FROM objectives_with_index)
),
new_objectives AS (
    -- Create new objectives that don't exist yet
    INSERT INTO objectives (objective, created_at, updated_at)
    SELECT DISTINCT
        owi.obj_text,
        NOW(),
        NOW()
    FROM objectives_with_index owi
    WHERE NOT EXISTS (
        SELECT 1 FROM existing_objectives eo WHERE eo.objective = owi.obj_text
    )
    RETURNING id as objective_id, objective
),
all_objectives AS (
    -- Combine existing and new objectives
    SELECT objective_id, objective FROM existing_objectives
    UNION ALL
    SELECT objective_id, objective FROM new_objectives
),
insert_objectives AS (
    -- Link objectives to scenario via junction table
    INSERT INTO scenario_objectives (scenario_id, objective_id, idx, created_at)
    SELECT 
        $1::uuid,
        ao.objective_id,
        owi.idx,
        NOW()
    FROM objectives_with_index owi
    JOIN all_objectives ao ON ao.objective = owi.obj_text
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
    FROM UNNEST($14::text[]) as param_item_id
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND COALESCE(array_length($14::text[], 1), 0) > 0
    ON CONFLICT (scenario_id, parameter_item_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_old_images AS (
    -- Delete old scenario image links (junction table entries)
    DELETE FROM scenario_images
    WHERE scenario_id = $1::uuid
),
link_images AS (
    -- Link images if provided (create junction table entries)
    INSERT INTO scenario_images (scenario_id, upload_id, name, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        (img->>'upload_id')::uuid,
        img->>'name',
        true,
        NOW(),
        NOW()
    FROM jsonb_array_elements(COALESCE($15::jsonb, '[]'::jsonb)) as img
    WHERE EXISTS (SELECT 1 FROM scenario_exists)
      AND jsonb_array_length(COALESCE($15::jsonb, '[]'::jsonb)) > 0
    ON CONFLICT (scenario_id, upload_id) DO UPDATE SET
        active = true,
        name = EXCLUDED.name,
        updated_at = NOW()
)
SELECT scenario_id, name FROM update_scenario

