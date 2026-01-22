-- Get scenario by ID (for _create_chat_for_scenario)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_scenario_by_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_by_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_by_id_v4(
    scenario_id uuid
)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    root_scenario_id uuid,
    parent_scenario_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    active boolean,
    profile_id uuid,
    department_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    s.id,
    (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
    (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1),
    (SELECT st.parent_id FROM scenario_tree_entry st WHERE st.child_id = s.id AND st.parent_id != s.id LIMIT 1) as root_scenario_id,
    (SELECT st.parent_id FROM scenario_tree_entry st WHERE st.child_id = s.id AND st.parent_id != s.id LIMIT 1) as parent_scenario_id,
    s.created_at,
    s.updated_at,
    EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE),
    NULL::uuid as profile_id,
    (SELECT sd.department_id FROM scenario_departments sd WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
FROM scenario_artifact s
WHERE s.id = api_get_scenario_by_id_v4.scenario_id
$$;