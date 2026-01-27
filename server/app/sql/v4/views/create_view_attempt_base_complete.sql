-- View: view_attempt_base_complete
-- Layer 1 Base View: Unified attempts with all primary connections.
-- Combines general_attempts_entry + practice_attempts_entry with connections
-- to profiles, simulations, departments, cohorts (general only).
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_attempt_base_complete AS
-- General attempts with all connections
SELECT
    a.id,
    a.created_at,
    a.updated_at,
    a.infinite_mode,
    a.archived,
    a.generated,
    a.mcp,
    a.active,
    'general'::text AS attempt_type,
    -- Profile connection
    apc.profiles_id AS profile_resource_id,
    -- Simulation connection
    asc_conn.simulations_id AS simulation_resource_id,
    -- Department connection (general only)
    adc.departments_id AS department_resource_id,
    -- Cohort connection (general only)
    acc.cohorts_id AS cohort_resource_id,
    -- Role connection (general only)
    arc.roles_id AS role_resource_id
FROM general_attempts_entry a
-- Required connections
JOIN general_attempts_profiles_connection apc ON apc.attempt_id = a.id
JOIN general_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
-- Optional connections (general only)
LEFT JOIN general_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN general_attempts_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN general_attempts_roles_connection arc ON arc.attempt_id = a.id
WHERE a.active = true

UNION ALL

-- Practice attempts with connections (no department/cohort/role)
SELECT
    a.id,
    a.created_at,
    a.updated_at,
    a.infinite_mode,
    a.archived,
    a.generated,
    a.mcp,
    a.active,
    'practice'::text AS attempt_type,
    -- Profile connection
    apc.profiles_id AS profile_resource_id,
    -- Simulation connection
    asc_conn.simulations_id AS simulation_resource_id,
    -- No department/cohort/role for practice
    NULL::uuid AS department_resource_id,
    NULL::uuid AS cohort_resource_id,
    NULL::uuid AS role_resource_id
FROM practice_attempts_entry a
-- Required connections
JOIN practice_attempts_profiles_connection apc ON apc.attempt_id = a.id
JOIN practice_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
WHERE a.active = true;
