-- Create a test scenario
-- Parameters: $1 = name (text, optional)
-- Returns: scenario_id (UUID)
INSERT INTO scenarios(name, active)
VALUES (COALESCE($1, 'Test Scenario'), true)
RETURNING id;

