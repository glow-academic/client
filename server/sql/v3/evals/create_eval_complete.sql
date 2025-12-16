-- Create eval with runs junction table entries and departments in a single transaction
-- Parameters: $1=name, $2=description, $3=rubric_id, $4=agent_id (agent being evaluated), $5=eval_agent_id (agent performing evaluation), $6=run_ids (uuid[]), $7=department_ids (uuid[] | NULL), $8=active (boolean), $9=profile_id (uuid)
-- Returns: eval_id

WITH new_eval AS (
    INSERT INTO evals (name, description, rubric_id, agent_id, eval_agent_id, active, created_at, updated_at)
    VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, COALESCE($8, true), NOW(), NOW())
    RETURNING id::text as eval_id
),
link_departments AS (
    -- Link departments if provided (array may be empty)
    INSERT INTO eval_departments (eval_id, department_id, active, created_at, updated_at)
    SELECT 
        ne.eval_id::uuid,
        d_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN UNNEST($7::uuid[]) as d_id
    WHERE $7::uuid[] IS NOT NULL AND COALESCE(array_length($7::uuid[], 1), 0) > 0
    ON CONFLICT (eval_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_runs AS (
    -- Link runs if provided (array may be empty)
    INSERT INTO eval_runs (eval_id, run_id, completed, created_at, updated_at)
    SELECT 
        ne.eval_id::uuid,
        r_id::uuid,
        false,  -- Initially not completed
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN UNNEST($6::uuid[]) as r_id
    WHERE $6::uuid[] IS NOT NULL AND COALESCE(array_length($6::uuid[], 1), 0) > 0
    ON CONFLICT (eval_id, run_id) DO UPDATE SET
        completed = false,
        updated_at = NOW()
)
SELECT eval_id FROM new_eval

