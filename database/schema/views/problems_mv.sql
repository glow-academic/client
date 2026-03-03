-- Materialized View: problems_mv
-- Lean problem-level data for activity pages.
--
-- Grain: One row per problem
-- Filter: none
--
-- Purpose: Exposes problem data with profile_id — name resolved in hydration layer
-- Section: PROBLEM (lean MV)
--
-- Dependencies: problems_entry, profiles_problems_connection

CREATE MATERIALIZED VIEW problems_mv AS
SELECT
    pe.id AS problem_id,
    pe.type::text AS type,
    pe.message,
    COALESCE(re.resolved, FALSE) AS resolved,
    pe.session_id,
    pe.created_at AS problem_created_at,
    pe.updated_at AS problem_updated_at,
    ppc.profiles_id AS profile_id
FROM problems_entry pe
LEFT JOIN profiles_problems_connection ppc
    ON ppc.problem_id = pe.id
-- Latest resolved state (append-only)
LEFT JOIN LATERAL (
    SELECT resolved FROM resolves_entry
    WHERE problem_id = pe.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) re ON true
WITH NO DATA;
