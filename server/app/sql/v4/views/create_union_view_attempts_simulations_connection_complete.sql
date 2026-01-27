-- View: attempts_simulations_connection
-- Unified attempt-simulation connections with attempt type derived from practice flag.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW attempts_simulations_connection AS
SELECT
    asc_conn.attempt_id,
    asc_conn.simulations_id,
    asc_conn.created_at,
    asc_conn.active,
    asc_conn.generated,
    asc_conn.mcp,
    ae.attempt_type AS type
FROM simulation_attempts_simulations_connection asc_conn
JOIN attempts_entry ae ON ae.id = asc_conn.attempt_id;
