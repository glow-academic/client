-- Insert activity record for WebSocket events (profile_id can be NULL)
INSERT INTO activity (message, endpoint, profile_id, error, created_at)
VALUES ($1, $2, $3, $4, now())

