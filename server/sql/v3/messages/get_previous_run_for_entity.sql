-- Get previous run_id and latest message_id for an entity (scenario, template, outline)
-- Parameters: $1=entity_id (uuid), $2=entity_type ('scenario'|'template'|'outline')
-- Returns: run_id, latest_message_id (assistant if exists, otherwise developer/system, otherwise null)
-- Latest message is the one with no active children in message_tree (leaf node)
WITH previous_runs AS (
    -- Get previous runs for scenario via problem_statement_runs
    SELECT DISTINCT psr.run_id, psr.created_at
    FROM problem_statement_runs psr
    JOIN problem_statements ps ON ps.id = psr.problem_statement_id
    JOIN scenario_problem_statements sps ON sps.problem_statement_id = ps.id AND sps.active = true
    WHERE sps.scenario_id = $1::uuid
    AND $2::text = 'scenario'
    
    UNION ALL
    
    -- Get previous runs for template via template_runs
    SELECT DISTINCT tr.run_id, tr.created_at
    FROM template_runs tr
    WHERE tr.template_id = $1::uuid
    AND $2::text = 'template'
    
    UNION ALL
    
    -- Get previous runs for outline via outline_runs
    SELECT DISTINCT or_.run_id, or_.created_at
    FROM outline_runs or_
    WHERE or_.outline_id = $1::uuid
    AND $2::text = 'outline'
),
latest_run AS (
    -- Get the most recent run
    SELECT run_id
    FROM previous_runs
    ORDER BY created_at DESC
    LIMIT 1
),
latest_message AS (
    -- Get the latest message from the run (message with no active children)
    SELECT m.id as latest_message_id
    FROM messages m
    JOIN message_runs mr ON mr.message_id = m.id
    JOIN latest_run lr ON lr.run_id = mr.run_id
    WHERE NOT EXISTS (
        SELECT 1 FROM message_tree mt 
        WHERE mt.parent_id = m.id AND mt.active = true
    )
    ORDER BY m.created_at DESC
    LIMIT 1
)
SELECT 
    (SELECT run_id FROM latest_run LIMIT 1) as run_id,
    (SELECT latest_message_id FROM latest_message LIMIT 1) as latest_message_id

