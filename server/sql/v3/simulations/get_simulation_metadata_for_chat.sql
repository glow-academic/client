-- Get simulation metadata from chat (optimized single JOIN query)
-- Parameters: $1=chat_id (uuid)
-- Returns: simulation_id, attempt_id, practice_simulation
SELECT 
    sa.simulation_id::text,
    sa.id::text as attempt_id,
    s.practice_simulation
FROM simulation_chats sc
JOIN attempt_chats ac ON ac.chat_id = sc.id
INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
INNER JOIN simulations s ON s.id = sa.simulation_id
WHERE sc.id = $1::uuid

