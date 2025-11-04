SELECT
    (SELECT COUNT(*) FROM profile_departments WHERE department_id = $1) as profile_count,
    (SELECT COUNT(*) FROM simulation_departments WHERE department_id = $1 AND active = true) as simulation_count,
    (SELECT COUNT(*) FROM scenario_departments WHERE department_id = $1 AND active = true) as scenario_count,
    (SELECT COUNT(*) FROM persona_departments WHERE department_id = $1 AND active = true) as persona_count,
    (SELECT COUNT(*) FROM document_departments WHERE department_id = $1 AND active = true) as document_count,
    (SELECT COUNT(*) FROM cohort_departments WHERE department_id = $1 AND active = true) as cohort_count

