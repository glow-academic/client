-- View: view_attempt_base_complete
-- Layer 1 Base View: Unified attempts with all primary connections.
-- Uses simulation_* entry and connection tables.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_attempt_base_complete AS
SELECT
    a.id,
    a.created_at,
    a.updated_at,
    a.infinite_mode,
    a.archived,
    a.generated,
    a.mcp,
    a.active,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS attempt_type,
    -- Profile connection
    apc.profiles_id AS profile_resource_id,
    -- Simulation connection
    asc_conn.simulations_id AS simulation_resource_id,
    -- Optional connections
    adc.departments_id AS department_resource_id,
    acc.cohorts_id AS cohort_resource_id,
    arc.roles_id AS role_resource_id
FROM simulation_attempts_entry a
-- Required connections
JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
-- Optional connections
LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN simulation_attempts_roles_connection arc ON arc.attempt_id = a.id
WHERE a.active = true;
