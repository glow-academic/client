-- Insert a new name resource
-- Parameters: $1 = name (text), $2 = mcp (boolean)

INSERT INTO names_resource (name, active, mcp, generated)
VALUES ($1, true, $2, $2)
RETURNING id;
