-- Create a test agent for test setup
-- Returns agent_id for use in tests
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
    INSERT INTO agents(
        name,
        description,
        model_id,
        active,
        role
    )
    VALUES (
        COALESCE(test_create_test_agent_v4.name, 'Test Agent'),
        COALESCE(test_create_test_agent_v4.description, 'Test Description'),
        test_create_test_agent_v4.model_id,
        COALESCE(test_create_test_agent_v4.active, true),
        COALESCE(test_create_test_agent_v4.role, 'assistant')::agent_role
    )
    RETURNING id, name, description, model_id, active, role::text, created_at;
$$;