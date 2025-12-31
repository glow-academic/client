-- Create a test persona
-- Parameters: $1 = name (text, optional)
-- Returns: persona_id (UUID)
INSERT INTO personas(name, active)
VALUES (COALESCE($1, 'Test Persona'), true)
RETURNING id::text as persona_id;

