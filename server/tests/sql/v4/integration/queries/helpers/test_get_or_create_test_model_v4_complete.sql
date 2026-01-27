-- Get existing model or create a new one with provider
-- Returns model_id for use in view_tests_entry
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
        SELECT m.id, 
               (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
               NULL::uuid as provider_id  -- Providers are now enums, not UUIDs
        FROM models_resource m
        WHERE EXISTS (SELECT 1 FROM model_flags_junction mf JOIN flags_resource fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active'  AND mf.value = TRUE)
        LIMIT 1
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (test_get_or_create_test_model_v4.name)
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    name_lookup AS (
        SELECT id FROM names_resource WHERE name = test_get_or_create_test_model_v4.name LIMIT 1
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES ('Test Model Description')
        ON CONFLICT (description) DO NOTHING
        RETURNING id
    ),
    description_lookup AS (
        SELECT id FROM descriptions_resource WHERE description = 'Test Model Description' LIMIT 1
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    new_model AS (
        INSERT INTO models_resource(value)
        SELECT 'gpt-4'
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING id
    ),
    new_model_name_link AS (
        INSERT INTO model_names_junction(model_id, name_id)
        SELECT nm.id, COALESCE(nr.id, nl.id)
        FROM new_model nm, name_resource nr FULL OUTER JOIN name_lookup nl ON true
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING model_id
    ),
    new_model_description_link AS (
        INSERT INTO model_descriptions_junction(model_id, description_id)
        SELECT nm.id, COALESCE(dr.id, dl.id)
        FROM new_model nm, description_resource dr FULL OUTER JOIN description_lookup dl ON true
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING model_id
    ),
    new_model_flag_link AS (
        INSERT INTO model_flags_junction (model_id, flag_id, value)
        SELECT nm.id, af.id, true
        FROM new_model nm, active_flag af
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING model_id
    )
    SELECT 
        COALESCE(em.id, nm.id) as model_id,
        COALESCE(em.name, (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = nm.id LIMIT 1)) as name,
        NULL::uuid as provider_id  -- Providers are now enums, not UUIDs
    FROM existing_model em
    FULL OUTER JOIN new_model nm ON true
    WHERE em.id IS NOT NULL OR nm.id IS NOT NULL
    LIMIT 1;
$$;