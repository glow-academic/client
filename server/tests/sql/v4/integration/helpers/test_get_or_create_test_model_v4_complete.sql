-- Get existing model or create a new one with provider
-- Returns model_id for use in tests
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
               (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
               (SELECT mp.provider_id FROM model_providers mp WHERE mp.model_id = m.id LIMIT 1) as provider_id
        FROM models m
        WHERE EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = TRUE)
        LIMIT 1
    ),
    existing_provider AS (
        SELECT p.id
        FROM providers p
        WHERE EXISTS (SELECT 1 FROM provider_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.provider_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_provider_flags AND pf.value = TRUE)
        LIMIT 1
    ),
    provider_name_resource AS (
        INSERT INTO names(name)
        VALUES ('Test Provider')
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    provider_name_lookup AS (
        SELECT id FROM names WHERE name = 'Test Provider' LIMIT 1
    ),
    provider_description_resource AS (
        INSERT INTO descriptions(description)
        VALUES ('Test Provider Description')
        ON CONFLICT (description) DO NOTHING
        RETURNING id
    ),
    provider_description_lookup AS (
        SELECT id FROM descriptions WHERE description = 'Test Provider Description' LIMIT 1
    ),
    provider_active_flag AS (
        SELECT id FROM flags WHERE name = 'active' LIMIT 1
    ),
    new_provider AS (
        INSERT INTO providers(value)
        SELECT 'openai'
        WHERE NOT EXISTS (SELECT 1 FROM existing_provider)
        RETURNING id
    ),
    new_provider_name_link AS (
        INSERT INTO provider_names(provider_id, name_id)
        SELECT np.id, COALESCE(pnr.id, pnl.id)
        FROM new_provider np, provider_name_resource pnr FULL OUTER JOIN provider_name_lookup pnl ON true
        WHERE NOT EXISTS (SELECT 1 FROM existing_provider)
        RETURNING provider_id
    ),
    new_provider_description_link AS (
        INSERT INTO provider_descriptions(provider_id, description_id)
        SELECT np.id, COALESCE(pdr.id, pdl.id)
        FROM new_provider np, provider_description_resource pdr FULL OUTER JOIN provider_description_lookup pdl ON true
        WHERE NOT EXISTS (SELECT 1 FROM existing_provider)
        RETURNING provider_id
    ),
    new_provider_flag_link AS (
        INSERT INTO provider_flags(provider_id, flag_id, type, value)
        SELECT np.id, paf.id, 'active'::type_provider_flags, true
        FROM new_provider np, provider_active_flag paf
        WHERE NOT EXISTS (SELECT 1 FROM existing_provider)
        RETURNING provider_id
    ),
    provider_to_use AS (
        SELECT COALESCE(ep.id, np.id) as id
        FROM existing_provider ep
        FULL OUTER JOIN new_provider np ON true
        WHERE ep.id IS NOT NULL OR np.id IS NOT NULL
        LIMIT 1
    ),
    name_resource AS (
        INSERT INTO names(name)
        VALUES (test_get_or_create_test_model_v4.name)
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    name_lookup AS (
        SELECT id FROM names WHERE name = test_get_or_create_test_model_v4.name LIMIT 1
    ),
    description_resource AS (
        INSERT INTO descriptions(description)
        VALUES ('Test Model Description')
        ON CONFLICT (description) DO NOTHING
        RETURNING id
    ),
    description_lookup AS (
        SELECT id FROM descriptions WHERE description = 'Test Model Description' LIMIT 1
    ),
    active_flag AS (
        SELECT id FROM flags WHERE name = 'active' LIMIT 1
    ),
    new_model AS (
        INSERT INTO models(value)
        SELECT 'gpt-4'
        FROM provider_to_use ptu
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING id
    ),
    new_model_name_link AS (
        INSERT INTO model_names(model_id, name_id)
        SELECT nm.id, COALESCE(nr.id, nl.id)
        FROM new_model nm, name_resource nr FULL OUTER JOIN name_lookup nl ON true
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING model_id
    ),
    new_model_description_link AS (
        INSERT INTO model_descriptions(model_id, description_id)
        SELECT nm.id, COALESCE(dr.id, dl.id)
        FROM new_model nm, description_resource dr FULL OUTER JOIN description_lookup dl ON true
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING model_id
    ),
    new_model_provider_link AS (
        INSERT INTO model_providers(model_id, provider_id)
        SELECT nm.id, ptu.id
        FROM new_model nm, provider_to_use ptu
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING model_id
    ),
    new_model_flag_link AS (
        INSERT INTO model_flags(model_id, flag_id, type, value)
        SELECT nm.id, af.id, 'active'::type_model_flags, true
        FROM new_model nm, active_flag af
        WHERE NOT EXISTS (SELECT 1 FROM existing_model)
        RETURNING model_id
    )
    SELECT 
        COALESCE(em.id, nm.id) as model_id,
        COALESCE(em.name, (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = nm.id LIMIT 1)) as name,
        COALESCE(em.provider_id, (SELECT mp.provider_id FROM model_providers mp WHERE mp.model_id = nm.id LIMIT 1)) as provider_id
    FROM existing_model em
    FULL OUTER JOIN new_model nm ON true
    WHERE em.id IS NOT NULL OR nm.id IS NOT NULL
    LIMIT 1;
$$;