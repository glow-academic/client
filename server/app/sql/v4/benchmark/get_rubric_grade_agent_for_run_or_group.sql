-- Get rubric_grade_agent_id for a run or group
-- Parameters: $1=eval_id (uuid), $2=run_id (uuid, nullable), $3=group_id (uuid, nullable), $4=use_groups (boolean)
-- Returns: rubric_grade_agent_id (uuid)
-- If use_groups=false: queries eval_runs_rubric_grade_agents
-- If use_groups=true: queries eval_groups_rubric_grade_agents
WITH run_rubric AS (
    SELECT 
        errga.rubric_grade_agent_id::uuid as rubric_grade_agent_id
    FROM eval_runs_rubric_grade_agents errga
    WHERE errga.eval_id = $1::uuid 
      AND errga.run_id = $2::uuid
      AND $4::boolean = false
    ORDER BY errga.created_at ASC
    LIMIT 1
),
group_rubric AS (
    SELECT 
        egga.rubric_grade_agent_id::uuid as rubric_grade_agent_id
    FROM eval_groups_rubric_grade_agents egga
    WHERE egga.eval_id = $1::uuid 
      AND egga.group_id = $3::uuid
      AND $4::boolean = true
    ORDER BY egga.created_at ASC
    LIMIT 1
)
SELECT 
    COALESCE(rr.rubric_grade_agent_id, gr.rubric_grade_agent_id) as rubric_grade_agent_id
FROM run_rubric rr
FULL OUTER JOIN group_rubric gr ON true

