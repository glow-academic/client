-- Get agent by ID for test verification
-- Returns agent data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_agent_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_agent_by_id_v4(
    input_agent_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    name text,
    description text,
    model_id uuid,
    active boolean,
    role text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        a.id as agent_id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as name,
        (SELECT d.description FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1) as description,
        (SELECT am.model_id FROM agent_models am WHERE am.agent_id = a.id LIMIT 1) as model_id,
        EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active'  AND af.value = TRUE) as active,
        NULL::text as role,
        a.created_at,
        a.updated_at
    FROM agents_resource a
    WHERE a.id = test_get_agent_by_id_v4.input_agent_id;
$$;