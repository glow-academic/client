-- Resolve attempt grading context by run_id
SELECT
    g.id AS grade_id,
    g.chat_id,
    c.attempt_id,
    sas.simulations_id AS simulation_id
FROM simulation_grades_entry g
JOIN simulation_chats_entry c ON c.id = g.chat_id
LEFT JOIN simulation_attempts_simulations_connection sas
    ON sas.attempt_id = c.attempt_id
   AND sas.active = true
WHERE g.run_id = $1
ORDER BY g.created_at DESC
LIMIT 1;
