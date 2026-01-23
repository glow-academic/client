-- Get simulation by ID with time_limit for test verification
-- Returns simulation data including time_limit for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_simulation_by_id_with_time_limit_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_simulation_by_id_with_time_limit_v4(
    input_simulation_id uuid
)
RETURNS TABLE (
    simulation_id uuid,
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    time_limit integer,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as title,
        (SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'active'  AND sf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'practice'  AND sf.value = TRUE) as practice_simulation,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id 
               AND sstl.active = true 
               AND stlr.active = true
               AND EXISTS (
                   SELECT 1 
                   FROM simulation_scenario_flags_junction ssf 
                   JOIN scenario_flags_resource sfr ON sfr.id = ssf.scenario_flag_id
                   WHERE ssf.simulation_id = ss.simulation_id 
                     AND sfr.scenario_id = ss.scenario_id
                     AND ssf.value = true
                     AND ssf.active = true
               )
            ),
            0
        ) as time_limit,
        s.created_at
    FROM simulations_resource s
    WHERE s.id = test_get_simulation_by_id_with_time_limit_v4.input_simulation_id;
$$;
