-- Get parent scenarios from simulation_scenarios that have at least one graded chat in this attempt
-- A scenario is considered "done" if it has a chat (linked via attempt_chats) with a grade
-- Uses simulation_scenarios as source of truth - checks if each parent scenario has a graded chat
-- Parameters: $1=attempt_id (uuid)
-- Returns: parent_scenario_id (from simulation_scenarios)
SELECT DISTINCT ss.scenario_id as parent_scenario_id
FROM simulation_scenarios ss
JOIN simulation_attempts sa ON sa.simulation_id = ss.simulation_id
JOIN attempt_chats ac ON ac.attempt_id = sa.id
JOIN simulation_chats sc ON sc.id = ac.chat_id
JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
-- Map child scenario to parent scenario via scenario_tree
-- If no mapping exists, assume child_id = parent_id (scenario is its own parent)
WHERE sa.id = $1::uuid
  AND (
    -- Case 1: Child scenario maps to this parent scenario via scenario_tree
    EXISTS (
      SELECT 1 FROM scenario_tree st 
      WHERE st.parent_id = ss.scenario_id 
        AND st.child_id = sc.scenario_id
    )
    -- Case 2: Child scenario IS the parent scenario (no child variant)
    OR sc.scenario_id = ss.scenario_id
  )
