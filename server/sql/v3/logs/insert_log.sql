INSERT INTO app_logs (
    event,
    level,
    message,
    correlation_id,
    actor,
    subject,
    context,
    error,
    created_at
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
)
RETURNING id

