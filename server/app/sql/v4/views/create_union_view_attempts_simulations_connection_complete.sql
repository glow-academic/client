-- Union View: attempts_simulations_connection
-- Combines general_attempts_simulations_connection + practice_attempts_simulations_connection
-- into a single view for queries that need unified attempt-simulation connections.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW attempts_simulations_connection AS
SELECT
    attempt_id,
    simulations_id,
    created_at,
    active,
    generated,
    mcp,
    'general'::text AS type
FROM general_attempts_simulations_connection

UNION ALL

SELECT
    attempt_id,
    simulations_id,
    created_at,
    active,
    generated,
    mcp,
    'practice'::text AS type
FROM practice_attempts_simulations_connection;
