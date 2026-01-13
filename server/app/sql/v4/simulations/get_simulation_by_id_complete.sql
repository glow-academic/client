-- Get simulation by ID
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_simulation_by_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_by_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_by_id_v4(
    simulation_id uuid
)
RETURNS TABLE (
    id uuid,
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    rubric_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    s.id,
    (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as title,
    (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM simulation_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1) as description,
    EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_simulation_flags AND sf.value = TRUE),
    EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE) as practice_simulation,
    (SELECT rga.rubric_id FROM simulation_scenarios_scenario_rubric_grade_agents sssrga 
     JOIN simulation_scenarios ss ON ss.simulation_id = sssrga.simulation_id AND ss.scenario_id = sssrga.scenario_id
     JOIN scenario_rubric_grade_agents srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
     JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
     WHERE ss.simulation_id = s.id 
       AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf 
         WHERE ssf.simulation_id = ss.simulation_id 
           AND ssf.scenario_id = ss.scenario_id 
           AND ssf.type = 'active'::type_simulation_scenario_flags 
           AND ssf.value = true)
     ORDER BY (SELECT sp.value FROM scenario_positions sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1) LIMIT 1) as rubric_id
FROM simulation s
WHERE s.id = api_get_simulation_by_id_v4.simulation_id
$$;