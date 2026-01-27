-- Union View: attempts_profiles_connection
-- Combines general_attempts_profiles_connection + practice_attempts_profiles_connection
-- into a single view for queries that need unified attempt-profile connections.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW attempts_profiles_connection AS
SELECT
    attempt_id,
    profiles_id,
    created_at,
    active,
    generated,
    mcp,
    'general'::text AS type
FROM general_attempts_profiles_connection

UNION ALL

SELECT
    attempt_id,
    profiles_id,
    created_at,
    active,
    generated,
    mcp,
    'practice'::text AS type
FROM practice_attempts_profiles_connection;
