INSERT INTO cohort_simulations (cohort_id, simulation_id, active)
SELECT $1, simulation_id, active
FROM cohort_simulations
WHERE cohort_id = $2

