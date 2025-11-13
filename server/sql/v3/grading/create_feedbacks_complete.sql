-- Batch create simulation chat feedback records from JSON array
-- Parameters: $1=grade_id (uuid), $2=feedbacks (jsonb array with objects containing: standard_id, total, feedback)
-- Creates multiple feedback records using jsonb_array_elements
INSERT INTO simulation_chat_feedbacks 
(standard_id, simulation_chat_grade_id, total, feedback, created_at)
SELECT 
    (feedback_item->>'standard_id')::uuid,
    $1::uuid,
    (feedback_item->>'total')::integer,
    feedback_item->>'feedback',
    NOW()
FROM jsonb_array_elements($2::jsonb) as feedback_item

