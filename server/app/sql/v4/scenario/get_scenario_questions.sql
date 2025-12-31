-- Get questions for a scenario
-- Parameters: $1=scenario_id (uuid)
-- Returns: question_id, active
SELECT 
    sq.question_id,
    sq.active
FROM scenario_questions sq
WHERE sq.scenario_id = $1::uuid
  AND sq.active = true;

