-- View: mv_practice_analytics
-- Compatibility view over mv_simulation_analytics filtered to practice attempts.
-- This avoids maintaining a separate practice MV while preserving expected shape.

DROP MATERIALIZED VIEW IF EXISTS mv_practice_analytics CASCADE;
DROP VIEW IF EXISTS mv_practice_analytics CASCADE;

CREATE VIEW mv_practice_analytics AS
SELECT *
FROM mv_simulation_analytics
WHERE attempt_type = 'practice';
