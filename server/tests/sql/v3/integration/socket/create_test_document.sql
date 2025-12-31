-- Create a test document
-- Parameters: $1 = department_id (UUID), $2 = profile_id (UUID), $3 = title (text, optional)
-- Returns: document_id (UUID)
INSERT INTO documents(
    title,
    department_id,
    profile_id,
    active
)
VALUES (
    COALESCE($3, 'Test Document'),
    $1::uuid,
    $2::uuid,
    true
)
RETURNING id;

