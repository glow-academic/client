-- Create a test agent
-- Parameters: $1 = name (text, optional), $2 = role (text, optional)
-- Returns: agent_id (UUID)
INSERT INTO agents(name, role, active)
VALUES (
    COALESCE($1, 'Test Agent'),
    COALESCE($2, 'scenario'),
    true
)
RETURNING id::text as agent_id;

