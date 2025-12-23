-- Find practice simulation with scenario linked to specific persona
-- Parameters: $1=persona_id (uuid), $2=department_ids (uuid[])
-- Returns: simulation_id, scenario_id, simulation_title, scenario_name, position
-- Note: Returns first matching simulation/scenario pair, prioritizing by position
WITH practice_simulations AS (
    SELECT DISTINCT
        sim.id as simulation_id,
        sim.title as simulation_title,
        ss.scenario_id,
        ss.position
    FROM simulations sim
    JOIN simulation_scenarios ss ON ss.simulation_id = sim.id AND ss.active = true
    JOIN scenarios s ON s.id = ss.scenario_id AND s.active = true
    JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
    WHERE sim.active = true
      AND sim.practice_simulation = true
      AND sp.persona_id = $1::uuid
),
filtered_by_department AS (
    SELECT 
        ps.simulation_id,
        ps.simulation_title,
        ps.scenario_id,
        ps.position
    FROM practice_simulations ps
    LEFT JOIN scenario_departments sd ON sd.scenario_id = ps.scenario_id AND sd.active = true
    LEFT JOIN simulation_departments simd ON simd.simulation_id = ps.simulation_id AND simd.active = true
    WHERE 
        -- If no department filter, show all
        (cardinality($2::uuid[]) = 0)
        -- Or scenario has matching department
        OR EXISTS (
            SELECT 1 FROM scenario_departments sd2 
            WHERE sd2.scenario_id = ps.scenario_id 
            AND sd2.active = true 
            AND sd2.department_id = ANY($2::uuid[])
        )
        -- Or scenario has no departments (cross-department)
        OR NOT EXISTS (
            SELECT 1 FROM scenario_departments sd3 
            WHERE sd3.scenario_id = ps.scenario_id 
            AND sd3.active = true
        )
        -- Or simulation has matching department
        OR EXISTS (
            SELECT 1 FROM simulation_departments simd2 
            WHERE simd2.simulation_id = ps.simulation_id 
            AND simd2.active = true 
            AND simd2.department_id = ANY($2::uuid[])
        )
        -- Or simulation has no departments (cross-department)
        OR NOT EXISTS (
            SELECT 1 FROM simulation_departments simd3 
            WHERE simd3.simulation_id = ps.simulation_id 
            AND simd3.active = true
        )
    GROUP BY ps.simulation_id, ps.simulation_title, ps.scenario_id, ps.position
),
scenario_with_name AS (
    SELECT 
        fbd.simulation_id,
        fbd.simulation_title,
        fbd.scenario_id,
        fbd.position,
        s.name as scenario_name
    FROM filtered_by_department fbd
    JOIN scenarios s ON s.id = fbd.scenario_id
)
SELECT 
    simulation_id::text,
    scenario_id::text,
    simulation_title,
    scenario_name,
    position
FROM scenario_with_name
ORDER BY position ASC
LIMIT 1

