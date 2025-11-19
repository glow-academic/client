-- Insert debug info for a model run
-- Parameters: $1=model_run_id (uuid), $2=content (text)
INSERT INTO debug_info (model_run_id, content, created_at)
VALUES ($1::uuid, $2::text, NOW())

