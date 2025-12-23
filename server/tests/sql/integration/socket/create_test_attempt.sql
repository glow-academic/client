-- Create a test simulation attempt
-- Parameters: $1 = simulation_id (UUID), $2 = profile_id (UUID), $3 = infinite_mode (bool, optional)
-- Returns: attempt_id (UUID)
INSERT INTO simulation_attempts(
    simulation_id,
    profile_id,
    infinite_mode,
    archived
)
VALUES (
    $1::uuid,
    $2::uuid,
    COALESCE($3, false),
    false
)
RETURNING id;

