-- View: attempts_profiles_connection
-- Unified attempt-profile connections with attempt type derived from practice flag.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW attempts_profiles_connection AS
SELECT
    apc.attempt_id,
    apc.profiles_id,
    apc.created_at,
    apc.active,
    apc.generated,
    apc.mcp,
    ae.attempt_type AS type
FROM simulation_attempts_profiles_connection apc
JOIN attempts_entry ae ON ae.id = apc.attempt_id;
