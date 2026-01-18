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
    (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as title,
    (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM simulation_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1) as description,
    EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'active' AND sf.value = TRUE),
    EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE) as practice_simulation,
    (SELECT srr.rubric_id FROM simulation_scenarios ss 
     JOIN simulation_scenario_rubrics ssr ON ssr.simulation_id = ss.simulation_id
     JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
     WHERE ss.simulation_id = s.id 
       AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
           AND sfr.scenario_id = ss.scenario_id 
           AND f.name = 'active' 
           AND ssf.value = true)
     ORDER BY (SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) LIMIT 1) as rubric_id
FROM simulation_artifact s
WHERE s.id = api_get_simulation_by_id_v4.simulation_id
$$;