-- Get existing model or create a new one with provider
-- Returns model_id for use in tests

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_or_create_test_model_v4(text);

-- Create function
CREATE OR REPLACE FUNCTION test_get_or_create_test_model_v4(
    name text DEFAULT 'Test Model'
)
RETURNS TABLE (
    model_id uuid,
    name text,
    provider_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    WITH existing_model AS (
        SELECT id, name, provider_id
        FROM models
        WHERE active = true
        LIMIT 1
    ),
    existing_provider AS (
        SELECT id
        FROM providers
        WHERE active = true
        LIMIT 1
    ),
    new_provider AS (
        INSERT INTO providers(name, description, value, active)
        SELECT 'Test Provider', 'Test Provider Description', 'openai', true
        WHERE NOT EXISTS (SELECT 1 FROM existing_provider)
        RETURNING id
    ),
    provider_to_use AS (
        SELECT COALESCE(ep.id, np.id) as id
        FROM existing_provider ep
        FULL OUTER JOIN new_provider np ON true
        WHERE ep.id IS NOT NULL OR np.id IS NOT NULL
        LIMIT 1
    ),
    new_model AS (
        INSERT INTO models(name, description, value, provider_id, active)
        SELECT 
            test_get_or_create_test_model_v4.name,
            'Test Model Description',
            'gpt-4',
            ptu.id,
            true
        FROM provider_to_use ptu
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING id, name, provider_id
    )
    SELECT 
        COALESCE(em.id, nm.id) as model_id,
        COALESCE(em.name, nm.name) as name,
        COALESCE(em.provider_id, nm.provider_id) as provider_id
    FROM existing_model em
    FULL OUTER JOIN new_model nm ON true
    WHERE em.id IS NOT NULL OR nm.id IS NOT NULL
    LIMIT 1;
$$;

COMMIT;

