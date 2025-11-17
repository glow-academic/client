-- Fix app_feedback_id_seq sequence to be in sync with existing data
-- This resolves the "duplicate key value violates unique constraint" error

-- Reset the sequence to the maximum ID value currently in the table
-- If the table is empty, start at 1, otherwise use MAX(id) + 1
SELECT setval(
    'app_feedback_id_seq',
    COALESCE((SELECT MAX(id) FROM app_feedback), 0) + 1,
    false
);

-- Verify the sequence is now correct
SELECT 
    'Max ID in table: ' || COALESCE(MAX(id)::text, 'NULL (table is empty)') as max_id_info,
    'Next sequence value will be: ' || (COALESCE(MAX(id), 0) + 1)::text as next_value_info
FROM app_feedback;

