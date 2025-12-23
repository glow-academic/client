-- Get eval dynamic flag and agent_id
-- Parameters: $1=eval_id (uuid)
-- Returns: dynamic (boolean), agent_id (text)
SELECT dynamic, agent_id::text as agent_id FROM evals WHERE id = $1::uuid

