-- Create a test agent for test setup
-- Returns agent_id for use in view_tests_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_agent_v4(uuid, text, text, text, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_agent_v4(
    model_id uuid,
    name text DEFAULT 'Test Agent',
    description text DEFAULT 'Test Description',
    role text DEFAULT 'assistant',
    active boolean DEFAULT true
)
RETURNS TABLE (
    agent_id uuid,
    name text,
    description text,
    model_id uuid,
    active boolean,
    role text,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_agent AS (
        INSERT INTO agents_resource DEFAULT VALUES
        RETURNING id, created_at
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (COALESCE(test_create_test_agent_v4.name, 'Test Agent'))
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (COALESCE(test_create_test_agent_v4.description, 'Test Description'))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    agent_name_link AS (
        INSERT INTO agent_names_junction(agent_id, name_id)
        SELECT na.id, nr.id
        FROM new_agent na, name_resource nr
        RETURNING agent_id, name_id
    ),
    agent_description_link AS (
        INSERT INTO agent_descriptions_junction(agent_id, description_id)
        SELECT na.id, dr.id
        FROM new_agent na, description_resource dr
        RETURNING agent_id, description_id
    ),
    agent_flag_link AS (
        INSERT INTO agent_flags_junction (agent_id, flag_id, value)
        SELECT na.id, af.id, COALESCE(test_create_test_agent_v4.active, true)
        FROM new_agent na, active_flag af
        RETURNING agent_id
    ),
    agent_model_link AS (
        INSERT INTO agent_models_junction(agent_id, model_id)
        SELECT na.id, test_create_test_agent_v4.model_id
        FROM new_agent na
        WHERE test_create_test_agent_v4.model_id IS NOT NULL
        RETURNING agent_id
    )
    SELECT 
        na.id as agent_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = na.id LIMIT 1) as name,
        (SELECT d.description FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = na.id LIMIT 1) as description,
        (SELECT am.model_id FROM agent_models_junction am WHERE am.agent_id = na.id LIMIT 1) as model_id,
        EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource fl ON af.flag_id = fl.id WHERE af.agent_id = na.id AND fl.name = 'active'  AND af.value = TRUE) as active,
        COALESCE(test_create_test_agent_v4.role, 'assistant') as role,
        na.created_at
    FROM new_agent na;
$$;