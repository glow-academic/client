-- Get scenario by ID (for _create_chat_for_scenario)
-- Parameters: $1=scenario_id (uuid)
-- Returns: all columns
SELECT * FROM scenarios WHERE id = $1::uuid

