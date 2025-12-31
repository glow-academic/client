-- Get eval dynamic flag and agent_id from eval_agents
-- Parameters: $1=eval_id (uuid)
-- Returns: dynamic (boolean), agent_id (text) - gets first agent from eval_agents
SELECT 
    e.dynamic,
    (SELECT ea.agent_id::text FROM eval_agents ea WHERE ea.eval_id = e.id ORDER BY ea.created_at LIMIT 1) as agent_id
FROM evals e
WHERE e.id = $1::uuid

