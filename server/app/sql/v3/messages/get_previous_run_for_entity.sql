-- Get previous run_id and latest message_id for an entity (scenario, template, outline)
-- Parameters: $1=entity_id (uuid), $2=entity_type ('scenario'|'template'|'outline')
-- Returns: run_id, latest_message_id (assistant if exists, otherwise developer/system, otherwise null)
-- Latest message is the one with no active children in message_tree (leaf node)
WITH previous_runs AS (
    -- Get previous runs for scenario via derived path: problem_statements → tool_call → tool_call_runs → run
    SELECT DISTINCT tcr.run_id, tcr.created_at
    FROM problem_statements ps
    JOIN tool_calls tc ON tc.id = ps.tool_call_id
    JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
    JOIN scenario_problem_statements sps ON sps.problem_statement_id = ps.id AND sps.active = true
    WHERE sps.scenario_id = $1::uuid
    AND $2::text = 'scenario'
    
    UNION ALL
    
    -- Get previous runs for template via derived path: templates → tool_call → tool_call_runs → run
    SELECT DISTINCT tcr.run_id, tcr.created_at
    FROM templates t
    JOIN tool_calls tc ON tc.id = t.tool_call_id
    JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
    WHERE t.id = $1::uuid
    AND $2::text = 'template'
    
    UNION ALL
    
    -- NOTE: outline_runs table was removed in migration 90
    -- Outlines are no longer a separate entity
    -- This branch returns no rows for 'outline' entity type
    SELECT DISTINCT NULL::uuid as run_id, NULL::timestamptz as created_at
    WHERE false AND $2::text = 'outline'
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

