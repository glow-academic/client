-- Get existing agent or create a new one
-- Returns agent_id for use in view_tests_entry
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
        SELECT a.id, 
               (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as name,
               (SELECT d.description FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1) as description,
               (SELECT am.model_id FROM agent_models_junction am WHERE am.agent_id = a.id LIMIT 1) as model_id
        FROM agents_resource a
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active'  AND af.value = TRUE)
        LIMIT 1
    ),
    model_to_use AS (
        SELECT COALESCE(test_get_or_create_test_agent_v4.model_id, em.model_id) as id
        FROM existing_agent em
        WHERE test_get_or_create_test_agent_v4.model_id IS NOT NULL OR em.model_id IS NOT NULL
        LIMIT 1
    ),
    fallback_model AS (
        SELECT id FROM models_resource m
        WHERE EXISTS (SELECT 1 FROM model_flags_junction mf JOIN flags_resource fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active'  AND mf.value = TRUE)
        LIMIT 1
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (test_get_or_create_test_agent_v4.name)
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    name_lookup AS (
        SELECT id FROM names_resource WHERE name = test_get_or_create_test_agent_v4.name LIMIT 1
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (test_get_or_create_test_agent_v4.description)
        ON CONFLICT (description) DO NOTHING
        RETURNING id
    ),
    description_lookup AS (
        SELECT id FROM descriptions_resource WHERE description = test_get_or_create_test_agent_v4.description LIMIT 1
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    new_agent AS (
        INSERT INTO agents_resource DEFAULT VALUES
        RETURNING id
    ),
    new_agent_filtered AS (
        SELECT na.id FROM new_agent na
        WHERE NOT EXISTS (SELECT 1 FROM existing_agent)
    ),
    new_agent_name_link AS (
        INSERT INTO agent_names_junction(agent_id, name_id)
        SELECT naf.id, COALESCE(nr.id, nl.id)
        FROM new_agent_filtered naf, name_resource nr FULL OUTER JOIN name_lookup nl ON true
        RETURNING agent_id
    ),
    new_agent_description_link AS (
        INSERT INTO agent_descriptions_junction(agent_id, description_id)
        SELECT naf.id, COALESCE(dr.id, dl.id)
        FROM new_agent_filtered naf, description_resource dr FULL OUTER JOIN description_lookup dl ON true
        RETURNING agent_id
    ),
    new_agent_model_link AS (
        INSERT INTO agent_models_junction(agent_id, model_id)
        SELECT naf.id, COALESCE(mtu.id, fm.id)
        FROM new_agent_filtered naf, model_to_use mtu FULL OUTER JOIN fallback_model fm ON true
        RETURNING agent_id
    ),
    new_agent_flag_link AS (
        INSERT INTO agent_flags_junction (agent_id, flag_id, value)
        SELECT naf.id, af.id, true
        FROM new_agent_filtered naf, active_flag af
        RETURNING agent_id
    )
    SELECT 
        COALESCE(ea.id, naf.id) as agent_id,
        COALESCE(ea.name, (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = naf.id LIMIT 1)) as name,
        COALESCE(ea.description, (SELECT d.description FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = naf.id LIMIT 1)) as description,
        COALESCE(ea.model_id, (SELECT am.model_id FROM agent_models_junction am WHERE am.agent_id = naf.id LIMIT 1)) as model_id
    FROM existing_agent ea
    FULL OUTER JOIN new_agent_filtered naf ON true
    WHERE ea.id IS NOT NULL OR naf.id IS NOT NULL
    LIMIT 1;
$$;