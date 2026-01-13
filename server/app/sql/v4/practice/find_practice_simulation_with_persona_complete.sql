-- Find practice simulation with scenario linked to specific persona
-- Converted to PostgreSQL function
-- Returns first matching simulation/scenario pair, prioritizing by position
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_find_practice_simulation_with_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_find_practice_simulation_with_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_find_practice_simulation_with_persona_v4(
    persona_id uuid,
    department_ids uuid[]
)
RETURNS TABLE (
    simulation_id text,
    scenario_id text,
    simulation_title text,
    scenario_name text,
    position_val integer
)
LANGUAGE sql
STABLE
AS $$
WITH practice_simulations AS (
    SELECT DISTINCT
        sim.id as simulation_id,
        (SELECT n.name FROM simulation_names simn JOIN names n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1) as simulation_title,
        ss.scenario_id,
        (SELECT sp.value FROM scenario_positions sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1) as position_val
    FROM simulation sim
    JOIN simulation_scenarios ss ON ss.simulation_id = sim.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf WHERE ssf.simulation_id = ss.simulation_id AND ssf.scenario_id = ss.scenario_id AND ssf.type = 'active'::type_simulation_scenario_flags AND ssf.value = true)
    JOIN scenarios s ON s.id = ss.scenario_id AND EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
    WHERE EXISTS (SELECT 1 FROM simulation_flags simf WHERE simf.simulation_id = sim.id AND simf.type = 'active'::type_simulation_flags AND simf.value = true)
      AND EXISTS (SELECT 1 FROM simulation_flags sf WHERE sf.simulation_id = sim.id AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE)
      AND sp.persona_id = api_find_practice_simulation_with_persona_v4.persona_id
),
filtered_by_department AS (
    SELECT 
        ps.simulation_id,
        ps.simulation_title,
        ps.scenario_id,
        ps.position_val
    FROM practice_simulations ps
    LEFT JOIN scenario_departments sd ON sd.scenario_id = ps.scenario_id AND sd.active = true
    LEFT JOIN simulation_departments simd ON simd.simulation_id = ps.simulation_id AND simd.active = true
    WHERE 
        -- If no department filter, show all
        (cardinality(api_find_practice_simulation_with_persona_v4.department_ids) = 0)
        -- Or scenario has matching department
        OR EXISTS (
            SELECT 1 FROM scenario_departments sd2 
            WHERE sd2.scenario_id = ps.scenario_id 
            AND sd2.active = true 
            AND sd2.department_id = ANY(api_find_practice_simulation_with_persona_v4.department_ids)
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
            AND simd2.department_id = ANY(api_find_practice_simulation_with_persona_v4.department_ids)
        )
        -- Or simulation has no departments (cross-department)
        OR NOT EXISTS (
            SELECT 1 FROM simulation_departments simd3 
            WHERE simd3.simulation_id = ps.simulation_id 
            AND simd3.active = true
        )
    GROUP BY ps.simulation_id, ps.simulation_title, ps.scenario_id, ps.position_val
),
scenario_with_name AS (
    SELECT 
        fbd.simulation_id,
        fbd.simulation_title,
        fbd.scenario_id,
        fbd.position_val,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as scenario_name
    FROM filtered_by_department fbd
    JOIN scenarios s ON s.id = fbd.scenario_id
)
SELECT 
    simulation_id::text,
    scenario_id::text,
    simulation_title,
    scenario_name,
    position_val as position
FROM scenario_with_name
ORDER BY position_val ASC
LIMIT 1
$$;