-- Get existing agent or create a new one
-- Returns agent_id for use in tests
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_or_create_test_agent_v4(text, text, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_or_create_test_agent_v4(
    name text DEFAULT 'Test Agent',
    description text DEFAULT 'Test Description',
    model_id uuid DEFAULT NULL
)
RETURNS TABLE (
    agent_id uuid,
    name text,
    description text,
    model_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    WITH existing_agent AS (
        SELECT id, name, description, model_id
        FROM agents
        WHERE active = true
        LIMIT 1
    ),
    model_to_use AS (
        SELECT COALESCE(test_get_or_create_test_agent_v4.model_id, em.model_id) as id
        FROM existing_agent em
        WHERE test_get_or_create_test_agent_v4.model_id IS NOT NULL OR em.model_id IS NOT NULL
        LIMIT 1
    ),
    new_agent AS (
        INSERT INTO agents(name, description, model_id, active)
        SELECT 
            test_get_or_create_test_agent_v4.name,
            test_get_or_create_test_agent_v4.description,
            COALESCE(mtu.id, (SELECT id FROM models WHERE active = true LIMIT 1)),
            true
        FROM model_to_use mtu
        WHERE NOT EXISTS (SELECT 1 FROM existing_agent)
        RETURNING id, name, description, model_id
    )
    SELECT 
        COALESCE(ea.id, na.id) as agent_id,
        COALESCE(ea.name, na.name) as name,
        COALESCE(ea.description, na.description) as description,
        COALESCE(ea.model_id, na.model_id) as model_id
    FROM existing_agent ea
    FULL OUTER JOIN new_agent na ON true
    WHERE ea.id IS NOT NULL OR na.id IS NOT NULL
    LIMIT 1;
$$;